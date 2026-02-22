from typing import TypedDict
from langgraph.graph import StateGraph, END
from app.agents.auditor import run_auditor
from app.agents.code_generator import run_code_generator
from app.agents.strategist import run_strategist


class PRState(TypedDict):
    repo_files: dict          # Original repo files (immutable)
    approved_plans: list      # Original user-approved plans (immutable)
    current_plans: list       # Plans for THIS iteration (initially = approved_plans, then = strategist output)
    current_files: dict       # Working copy of files, updated after each code_gen
    fixes: list               # Latest iteration's fixes
    all_fixes: list           # Accumulated fixes across all iterations (for final PR)
    qa_iterations: int
    qa_clean: bool
    qa_violations: list       # Violations from most recent QA rescan
    qa_history: list          # [{iteration, violations, plans, is_clean}] for DB persistence
    reasoning_log: list


def code_gen_node(state: PRState) -> dict:
    plans_by_file = {}
    for plan in state["current_plans"]:
        plans_by_file.setdefault(plan["file"], []).append(plan)

    fixes = []
    for file_path, plans in plans_by_file.items():
        original = state["current_files"].get(file_path, "")
        fixed = run_code_generator(file_path, original, plans)
        fixes.append({
            "file": file_path,
            "original_content": original,
            "fixed_content": fixed,
            "plans": plans,
        })

    # Update current_files with the new fixes
    updated_files = {**state["current_files"]}
    for fix in fixes:
        updated_files[fix["file"]] = fix["fixed_content"]

    # Merge into all_fixes: replace same-file entries but preserve original_content from first iteration
    existing_by_file = {f["file"]: f for f in state["all_fixes"]}
    for fix in fixes:
        if fix["file"] in existing_by_file:
            # Keep the original_content from the first iteration
            existing_by_file[fix["file"]]["fixed_content"] = fix["fixed_content"]
            existing_by_file[fix["file"]]["plans"] = fix["plans"]
        else:
            existing_by_file[fix["file"]] = dict(fix)
    merged_all_fixes = list(existing_by_file.values())

    return {
        "fixes": fixes,
        "all_fixes": merged_all_fixes,
        "current_files": updated_files,
        "reasoning_log": state["reasoning_log"] + [{
            "agent": "Code Generator",
            "action": "generate",
            "output": f"{len(fixes)} files modified"
        }]
    }


def qa_rescan_node(state: PRState) -> dict:
    new_violations = run_auditor(state["current_files"], is_qa_rescan=True)
    iteration = state["qa_iterations"] + 1
    is_clean = len(new_violations) == 0

    history_entry = {
        "iteration": iteration,
        "violations": new_violations,
        "plans": [],
        "is_clean": is_clean,
    }

    return {
        "qa_iterations": iteration,
        "qa_clean": is_clean,
        "qa_violations": new_violations,
        "qa_history": state["qa_history"] + [history_entry],
        "reasoning_log": state["reasoning_log"] + [{
            "agent": "QA Re-scan",
            "action": f"iteration {iteration}",
            "output": "CLEAN" if is_clean else f"{len(new_violations)} new violations"
        }]
    }


def strategist_replan_node(state: PRState) -> dict:
    new_plans = run_strategist(state["qa_violations"])

    # Attach plans to the latest qa_history entry
    updated_history = list(state["qa_history"])
    if updated_history:
        updated_history[-1] = {**updated_history[-1], "plans": new_plans}

    return {
        "current_plans": new_plans,
        "qa_history": updated_history,
        "reasoning_log": state["reasoning_log"] + [{
            "agent": "Strategist (Replan)",
            "action": "replan",
            "output": f"{len(new_plans)} remediation plans for {len(state['qa_violations'])} violations"
        }]
    }


def qa_router(state: PRState) -> str:
    if state["qa_clean"]:
        return "done"
    elif state["qa_iterations"] >= 3:
        return "done"
    else:
        return "replan"


def build_pr_graph():
    graph = StateGraph(PRState)
    graph.add_node("code_gen", code_gen_node)
    graph.add_node("qa_rescan", qa_rescan_node)
    graph.add_node("strategist_replan", strategist_replan_node)
    graph.set_entry_point("code_gen")
    graph.add_edge("code_gen", "qa_rescan")
    graph.add_conditional_edges("qa_rescan", qa_router, {
        "replan": "strategist_replan",
        "done": END,
    })
    graph.add_edge("strategist_replan", "code_gen")
    return graph.compile()


pr_app = build_pr_graph()
