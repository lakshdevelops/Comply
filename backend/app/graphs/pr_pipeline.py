from typing import TypedDict
from langgraph.graph import StateGraph, END
from app.agents.auditor import run_auditor
from app.agents.code_generator import run_code_generator


class PRState(TypedDict):
    repo_files: dict              # {filename: content}
    approved_plans: list          # RemediationPlan dicts
    fixes: list                   # {file, original_content, fixed_content, plans}
    qa_iterations: int
    qa_clean: bool
    reasoning_log: list


def code_gen_node(state: PRState) -> dict:
    plans_by_file = {}
    for plan in state["approved_plans"]:
        plans_by_file.setdefault(plan["file"], []).append(plan)

    fixes = []
    for file_path, plans in plans_by_file.items():
        original = state["repo_files"].get(file_path, "")
        fixed = run_code_generator(file_path, original, plans)
        fixes.append({
            "file": file_path,
            "original_content": original,
            "fixed_content": fixed,
            "plans": plans,
        })

    return {
        "fixes": fixes,
        "reasoning_log": state["reasoning_log"] + [{
            "agent": "Code Generator",
            "action": "generate",
            "output": f"{len(fixes)} files modified"
        }]
    }


def qa_rescan_node(state: PRState) -> dict:
    modified_files = {**state["repo_files"]}
    for fix in state["fixes"]:
        modified_files[fix["file"]] = fix["fixed_content"]

    new_violations = run_auditor(modified_files, is_qa_rescan=True)
    iteration = state["qa_iterations"] + 1
    is_clean = len(new_violations) == 0

    return {
        "qa_iterations": iteration,
        "qa_clean": is_clean,
        "reasoning_log": state["reasoning_log"] + [{
            "agent": "QA Re-scan",
            "action": f"iteration {iteration}",
            "output": "CLEAN" if is_clean else f"{len(new_violations)} new violations"
        }]
    }


def qa_router(state: PRState) -> str:
    if state["qa_clean"]:
        return "done"
    elif state["qa_iterations"] >= 3:
        return "done"
    else:
        return "retry"


def build_pr_graph():
    graph = StateGraph(PRState)
    graph.add_node("code_gen", code_gen_node)
    graph.add_node("qa_rescan", qa_rescan_node)
    graph.set_entry_point("code_gen")
    graph.add_edge("code_gen", "qa_rescan")
    graph.add_conditional_edges("qa_rescan", qa_router, {
        "retry": "code_gen",
        "done": END,
    })
    return graph.compile()


pr_app = build_pr_graph()
