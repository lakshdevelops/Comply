import base64
import time

import requests
from github import Github

from app.core.config import settings


def exchange_code_for_token(code: str) -> dict:
    """Exchange an OAuth authorization code for an access token.

    POST to GitHub's OAuth token endpoint with client credentials and the
    temporary code received from the OAuth callback.

    Args:
        code: The temporary authorization code from the GitHub OAuth flow.

    Returns:
        A dict containing access_token, token_type, scope, and other fields
        returned by the GitHub OAuth API.
    """
    response = requests.post(
        "https://github.com/login/oauth/access_token",
        json={
            "client_id": settings.GITHUB_CLIENT_ID,
            "client_secret": settings.GITHUB_CLIENT_SECRET,
            "code": code,
        },
        headers={"Accept": "application/json"},
    )
    response.raise_for_status()
    return response.json()


def get_user_info(access_token: str) -> dict:
    """Get GitHub user profile information.

    Args:
        access_token: A valid GitHub OAuth access token.

    Returns:
        A dict with login, name, and avatar_url for the authenticated user.
    """
    g = Github(access_token)
    user = g.get_user()
    return {
        "login": user.login,
        "name": user.name,
        "avatar_url": user.avatar_url,
    }


def get_user_repos(access_token: str) -> list[dict]:
    """List repositories the authenticated user has access to.

    Returns up to 50 repos sorted by most recently updated.

    Args:
        access_token: A valid GitHub OAuth access token.

    Returns:
        A list of dicts each containing name, full_name, owner, private,
        and default_branch.
    """
    g = Github(access_token)
    repos = []
    for repo in g.get_user().get_repos(sort="updated"):
        repos.append(
            {
                "name": repo.name,
                "full_name": repo.full_name,
                "owner": repo.owner.login,
                "private": repo.private,
                "default_branch": repo.default_branch,
            }
        )
        if len(repos) >= 50:
            break
    return repos


def get_repo_infra_files(
    access_token: str, owner: str, repo_name: str
) -> dict[str, str]:
    """Fetch infrastructure-related files from a repository.

    Walks the repository tree recursively and reads files matching
    infrastructure patterns (Terraform, YAML/YML configs, Dockerfiles,
    docker-compose files). Directories such as node_modules, .git, vendor,
    __pycache__, and .next are excluded.

    Args:
        access_token: A valid GitHub OAuth access token.
        owner: The repository owner (user or organization login).
        repo_name: The repository name.

    Returns:
        A dict mapping file paths to their decoded text content.
    """
    g = Github(access_token)
    repo = g.get_repo(f"{owner}/{repo_name}")

    # Get full tree recursively
    tree = repo.get_git_tree(repo.default_branch, recursive=True)

    infra_extensions = {".tf", ".yaml", ".yml"}
    infra_filenames = {"Dockerfile"}
    exclude_dirs = {"node_modules", ".git", "vendor", "__pycache__", ".next"}

    files: dict[str, str] = {}
    for item in tree.tree:
        if item.type != "blob":
            continue

        # Skip excluded directories
        if any(excluded in item.path for excluded in exclude_dirs):
            continue

        # Check if file matches infra patterns
        name = item.path.split("/")[-1]
        ext = "." + name.rsplit(".", 1)[-1] if "." in name else ""

        is_infra = (
            ext in infra_extensions
            or name in infra_filenames
            or name.startswith("docker-compose")
        )

        if is_infra:
            try:
                content = repo.get_contents(item.path, ref=repo.default_branch)
                if content.encoding == "base64":
                    files[item.path] = base64.b64decode(content.content).decode(
                        "utf-8"
                    )
                else:
                    files[item.path] = content.decoded_content.decode("utf-8")
            except Exception:
                continue  # Skip files we can't read

    return files


def create_pr(
    access_token: str,
    owner: str,
    repo_name: str,
    file_fixes: list[dict],
    plans: list[dict],
) -> dict:
    """Create a branch with fixed files and open a pull request.

    For each entry in file_fixes, the corresponding file on the new branch is
    updated with the fixed content. A pull request is opened against the
    repository's default branch with a description summarising the
    remediation plans.

    Args:
        access_token: A valid GitHub OAuth access token.
        owner: The repository owner (user or organization login).
        repo_name: The repository name.
        file_fixes: A list of dicts each containing ``file`` (path) and
            ``fixed_content`` (the corrected file text).
        plans: A list of remediation plan dicts used to build the PR
            description.

    Returns:
        A dict with pr_url, branch, and pr_number.
    """
    g = Github(access_token)
    repo = g.get_repo(f"{owner}/{repo_name}")
    base_branch = repo.default_branch

    # Create branch name
    branch_name = f"comply/fix-{int(time.time())}"

    # Create branch from default branch
    base_ref = repo.get_git_ref(f"heads/{base_branch}")
    repo.create_git_ref(f"refs/heads/{branch_name}", base_ref.object.sha)

    # Commit each fixed file
    for fix in file_fixes:
        contents = repo.get_contents(fix["file"], ref=branch_name)
        repo.update_file(
            fix["file"],
            f"fix: resolve regulatory violations in {fix['file']}",
            fix["fixed_content"],
            contents.sha,
            branch=branch_name,
        )

    # Build PR description
    pr_body = build_pr_description(plans)

    # Create PR
    pr = repo.create_pull(
        title=f"[Comply] Fix {len(plans)} regulatory violations",
        body=pr_body,
        head=branch_name,
        base=base_branch,
    )

    return {
        "pr_url": pr.html_url,
        "branch": branch_name,
        "pr_number": pr.number,
    }


def build_pr_description(plans: list[dict]) -> str:
    """Build a Markdown PR body summarising the remediation plans.

    Args:
        plans: A list of remediation plan dicts, each optionally containing
            priority, explanation, regulation_citation,
            what_needs_to_change, and estimated_effort.

    Returns:
        A Markdown-formatted string suitable for use as a PR body.
    """
    emoji = {"P0": "\U0001f534", "P1": "\U0001f7e0", "P2": "\U0001f7e1"}
    body = "## Regulatory Compliance Fix\n\n"
    body += f"This PR addresses **{len(plans)} violations** "
    body += "approved by the compliance team via Comply.\n\n"
    body += "### Violations Fixed\n\n"
    for plan in plans:
        e = emoji.get(plan.get("priority", "P2"), "\U0001f7e1")
        explanation = plan.get("explanation", "")[:80]
        citation = plan.get("regulation_citation", "")[:100]
        change = plan.get("what_needs_to_change", "")
        effort = plan.get("estimated_effort", "N/A")
        body += f"#### {e} {explanation}\n"
        body += f"**Regulation:** {citation}\n"
        body += f"**Change:** {change}\n"
        body += f"**Effort:** {effort}\n\n"
    body += "---\n"
    body += "*Approved and generated by Comply.*\n"
    body += "*Review the code changes before merging.*\n"
    return body
