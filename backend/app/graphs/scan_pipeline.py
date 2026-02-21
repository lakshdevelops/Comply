from typing import TypedDict
from langgraph.graph import StateGraph, END
from app.agents.auditor import run_auditor
from app.agents.strategist import run_strategist


class ScanState(TypedDict):
    repo_files: dict          # {filename: content}
    violations: list
    remediation_plans: list
    reasoning_log: list


def auditor_node(state: ScanState) -> dict:
    violations = run_auditor(state["repo_files"])
    return {
        "violations": violations,
        "reasoning_log": state["reasoning_log"] + [{
            "agent": "Auditor",
            "action": "scan",
            "output": f"{len(violations)} violations detected"
        }]
    }


def strategist_node(state: ScanState) -> dict:
    plans = run_strategist(state["violations"])
    return {
        "remediation_plans": plans,
        "reasoning_log": state["reasoning_log"] + [{
            "agent": "Strategist",
            "action": "plan",
            "output": f"{len(plans)} remediation plans produced"
        }]
    }


def build_scan_graph():
    graph = StateGraph(ScanState)
    graph.add_node("auditor", auditor_node)
    graph.add_node("strategist", strategist_node)
    graph.set_entry_point("auditor")
    graph.add_edge("auditor", "strategist")
    graph.add_edge("strategist", END)
    return graph.compile()


scan_app = build_scan_graph()
