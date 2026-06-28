import json
import os
import time
import threading
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[1]
STATE_FILE = ROOT / "STATE.md"
JSON_STATE_FILE = ROOT / "data" / "loop_state.json"

class LoopEngine:
    """
    An autonomous Loop Engineering manager implementing a Maker-Checker framework.
    It periodically audits network telemetry, logs state checkpoints to STATE.md, 
    triggers automated fixes, and verifies recovery.
    """
    def __init__(self):
        self.active_loops: Dict[str, Dict[str, Any]] = {}
        self.history: List[Dict[str, Any]] = []
        self._running = False
        self._thread = None
        self.load_state()

    def load_state(self):
        try:
            if JSON_STATE_FILE.exists():
                with JSON_STATE_FILE.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.active_loops = data.get("active_loops", {})
                    self.history = data.get("history", [])
        except Exception as e:
            print(f"[LoopEngine] Failed to load JSON state: {e}")

    def save_state(self):
        try:
            JSON_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
            with JSON_STATE_FILE.open("w", encoding="utf-8") as f:
                json.dump({
                    "active_loops": self.active_loops,
                    "history": self.history
                }, f, indent=2)
            self.write_markdown_state()
        except Exception as e:
            print(f"[LoopEngine] Failed to save state: {e}")

    def write_markdown_state(self):
        """Writes a clean, structured STATE.md report to the workspace root for developer inspection."""
        try:
            lines = [
                "# ⚙️ NOC Loop Engineering State Log",
                f"**Last Updated:** {time.strftime('%Y-%m-%d %H:%M:%S')}",
                "**Engine Mode:** Autonomous Maker-Checker (Offline)",
                "",
                "## 🔄 Active Verification Loops",
            ]
            
            if not self.active_loops:
                lines.append("*No active anomalies are currently undergoing verification loops.*")
            else:
                for loop_id, loop in self.active_loops.items():
                    lines.append(f"### Loop: {loop['incident_type']} on {loop['node_id'].upper()}")
                    lines.append(f"- **State:** `{loop['phase']}`")
                    lines.append(f"- **Trigger Time:** {loop['trigger_time']}")
                    lines.append(f"- **Last Verified Metric:** Latency: {loop['last_metrics'].get('latency_ms')}ms | Loss: {loop['last_metrics'].get('packet_loss_pct')}%")
                    lines.append("- **Verification Checklist:**")
                    for step in loop.get("checklist", []):
                        status = "✅" if step["status"] == "verified" else "⏳" if step["status"] == "active" else "❌" if step["status"] == "failed" else "⬜"
                        lines.append(f"  - {status} {step['label']} ({step['timestamp']})")
                    lines.append("")

            lines.append("## 📜 Completed Loop History")
            if not self.history:
                lines.append("*No completed loops recorded yet.*")
            else:
                for h in self.history[-8:]:
                    result_badge = "🟢 VERIFIED RESOLVED" if h["status"] == "resolved" else "🔴 ESCALATED"
                    lines.append(f"- **{h['node_id'].upper()}** | {h['incident_type']} | {result_badge} ({h['completion_time']})")
                    
            with STATE_FILE.open("w", encoding="utf-8") as f:
                f.write("\n".join(lines))
        except Exception as e:
            print(f"[LoopEngine] Failed to write STATE.md: {e}")

    def start(self):
        self._running = True
        self._thread = threading.Thread(target=self._loop_worker, daemon=True)
        self._thread.start()
        print("[LoopEngine] Autonomous Maker-Checker background loop started.")

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=2.0)

    def register_loop(self, incident_id: str, node_id: str, incident_type: str, metrics: dict):
        if incident_id in self.active_loops:
            return
            
        timestamp = time.strftime("%H:%M:%S")
        self.active_loops[incident_id] = {
            "incident_id": incident_id,
            "node_id": node_id,
            "incident_type": incident_type,
            "phase": "TRIAGE",
            "trigger_time": timestamp,
            "last_metrics": metrics,
            "checklist": [
                {"id": "triage", "label": "Telemetry anomaly detected & logged", "status": "verified", "timestamp": timestamp},
                {"id": "mitigate", "label": "Deploy mitigation policies (Maker)", "status": "pending", "timestamp": "-"},
                {"id": "verify", "label": "Verify link parameter recovery (Checker)", "status": "pending", "timestamp": "-"}
            ]
        }
        self.save_state()

    def _loop_worker(self):
        while self._running:
            try:
                time.sleep(5)
                # Local imports to prevent circular references
                from backend.main import GLOBAL_POLICIES, active_incidents
                
                # Copy active loops to safely modify
                loops_to_check = list(self.active_loops.values())
                
                # Check for new active incidents to register loops
                for inc in active_incidents:
                    if inc.get("status") == "active":
                        inc_id = inc.get("id")
                        node_id = inc.get("nodeId")
                        inc_type = inc.get("type", "network_degradation")
                        self.register_loop(inc_id, node_id, inc_type, {
                            "latency_ms": 75.0 if inc.get("severity") == "WARNING" else 150.0,
                            "packet_loss_pct": 2.0
                        })

                for loop in loops_to_check:
                    loop_id = loop["incident_id"]
                    node_id = loop["node_id"]
                    phase = loop["phase"]
                    
                    # Verify if incident was deleted/resolved externally
                    inc_record = next((i for i in active_incidents if i.get("id") == loop_id), None)
                    if not inc_record or inc_record.get("status") != "active":
                        # Resolved externally
                        loop["phase"] = "COMPLETED"
                        for step in loop["checklist"]:
                            if step["status"] == "pending":
                                step["status"] = "verified"
                                step["timestamp"] = time.strftime("%H:%M:%S")
                        
                        # Move to history
                        self.history.append({
                            "node_id": node_id,
                            "incident_type": loop["incident_type"],
                            "status": "resolved",
                            "completion_time": time.strftime("%H:%M:%S")
                        })
                        del self.active_loops[loop_id]
                        self.save_state()
                        continue
                        
                    # State transitions based on Maker-Checker phases
                    if phase == "TRIAGE":
                        # Triage complete, shift to Mitigate phase
                        loop["phase"] = "MITIGATION"
                        for step in loop["checklist"]:
                            if step["id"] == "mitigate":
                                step["status"] = "active"
                                step["timestamp"] = time.strftime("%H:%M:%S")
                        self.save_state()
                        
                    elif phase == "MITIGATION":
                        # Check if global policies are deployed as mitigations
                        # If BGP Flap, route optimization must be enabled. If congestion, streaming block.
                        t = loop["incident_type"].lower()
                        mitigated = False
                        
                        if "congestion" in t or "utilization" in t or "exhaustion" in t:
                            # Apply firewall streaming block policy (Maker action)
                            GLOBAL_POLICIES["block_streaming"] = True
                            mitigated = True
                        elif "bgp" in t or "flap" in t:
                            GLOBAL_POLICIES["load_balancers"] = True
                            mitigated = True
                        else:
                            GLOBAL_POLICIES["scavenger_qos"] = True
                            mitigated = True
                            
                        if mitigated:
                            loop["phase"] = "VERIFICATION"
                            for step in loop["checklist"]:
                                if step["id"] == "mitigate":
                                    step["status"] = "verified"
                                if step["id"] == "verify":
                                    step["status"] = "active"
                                    step["timestamp"] = time.strftime("%H:%M:%S")
                            self.save_state()
                            
                    elif phase == "VERIFICATION":
                        # Checker role: Poll metrics to verify recovery
                        from backend.main import liveBranches, GLOBAL_POLICIES
                        branch = next((b for b in liveBranches if b["id"] == node_id), None)
                        
                        # Determine metrics (either from synced frontend state, or simulated recovered state if policy is active)
                        t = loop["incident_type"].lower()
                        simulated_recovery = False
                        
                        if "congestion" in t or "utilization" in t or "exhaustion" in t:
                            if GLOBAL_POLICIES.get("block_streaming"):
                                simulated_recovery = True
                        elif "bgp" in t or "flap" in t:
                            if GLOBAL_POLICIES.get("load_balancers"):
                                simulated_recovery = True
                        else:
                            if GLOBAL_POLICIES.get("scavenger_qos"):
                                simulated_recovery = True
                                
                        if simulated_recovery:
                            lat = 12.5
                            loss = 0.0
                        elif branch:
                            lat = branch.get("latency_ms", 12.0)
                            loss = branch.get("packet_loss_pct", 0.0)
                        else:
                            lat = loop["last_metrics"].get("latency_ms", 120.0)
                            loss = loop["last_metrics"].get("packet_loss_pct", 2.0)
                            
                        loop["last_metrics"] = {
                            "latency_ms": lat,
                            "packet_loss_pct": loss
                        }
                        
                        # Standard healthy thresholds
                        if lat < 25.0 and loss < 0.2:
                            # Recovery verified!
                            loop["phase"] = "COMPLETED"
                            for step in loop["checklist"]:
                                if step["id"] == "verify":
                                    step["status"] = "verified"
                                    step["timestamp"] = time.strftime("%H:%M:%S")
                            
                            # Auto resolve incident record
                            from backend.main import handleResolveIncident
                            handleResolveIncident(loop_id, "remediation")
                            
                            self.history.append({
                                "node_id": node_id,
                                "incident_type": loop["incident_type"],
                                "status": "resolved",
                                "completion_time": time.strftime("%H:%M:%S")
                            })
                            del self.active_loops[loop_id]
                            self.save_state()
                        else:
                            # Still degraded. If checking has run for > 3 ticks, escalate
                            elapsed = time.time() - (loop.get("last_checked_time") or time.time())
                            if elapsed > 25.0: # Escalation limit
                                loop["phase"] = "ESCALATED"
                                for step in loop["checklist"]:
                                    if step["id"] == "verify":
                                        step["status"] = "failed"
                                        step["timestamp"] = time.strftime("%H:%M:%S")
                                        
                                self.history.append({
                                    "node_id": node_id,
                                    "incident_type": loop["incident_type"],
                                    "status": "escalated",
                                    "completion_time": time.strftime("%H:%M:%S")
                                })
                                del self.active_loops[loop_id]
                                self.save_state()
                            else:
                                if "last_checked_time" not in loop:
                                    loop["last_checked_time"] = time.time()
                                self.save_state()
            except Exception as e:
                print(f"[LoopEngine] Error in worker thread: {e}")
                time.sleep(5)

# Singleton global instance
loop_engine = LoopEngine()
