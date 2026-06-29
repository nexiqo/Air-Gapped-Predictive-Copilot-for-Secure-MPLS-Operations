import random
import time
from typing import Any

class EmployeeRLAgent:
    """
    An employee workstation represented as a Reinforcement Learning Q-Agent.
    The agent chooses actions (applications) to maximize its utility (productivity reward)
    in response to environmental state inputs (network latency, firewall block policies).
    """
    def __init__(self, employee_id: str, role: str, dept: str):
        self.employee_id = employee_id
        self.role = role
        self.dept = dept
        self.state = "FOCUSED"
        self.q_table = {
            "FOCUSED": {"work": 1.0, "chat": 0.5, "media": 0.2, "idle": 0.1},
            "COLLABORATING": {"work": 0.5, "chat": 1.0, "media": 0.1, "idle": 0.1},
            "DISTRACTED": {"work": 0.2, "chat": 0.3, "media": 1.2, "idle": 0.2},
            "IDLE": {"work": 0.3, "chat": 0.2, "media": 0.2, "idle": 1.0}
        }
        
    def step(self, network_latency: float, block_streaming: bool, scavenger_qos: bool) -> dict[str, Any]:
        # 1. Update State transitions dynamically based on network latency
        # High latency frustrates workers and makes them shift to distracted/media consumption
        distract_incentive = min(0.6, network_latency / 120.0)
        self.q_table["FOCUSED"]["media"] = round(0.2 + distract_incentive, 2)
        
        # 2. Reinforcement Learning Rewards: Adjust Q-values based on policies
        if block_streaming:
            # High penalty for media streaming (firewall block)
            self.q_table["DISTRACTED"]["media"] = -0.5
            self.q_table["FOCUSED"]["media"] = -0.5
            # Force transition back to work
            self.q_table["DISTRACTED"]["work"] = 1.5
        else:
            # Standard reward for media streaming when unblocked
            self.q_table["DISTRACTED"]["media"] = 1.6
            self.q_table["DISTRACTED"]["work"] = 0.2
            
        if scavenger_qos:
            # Moderate QoS throttle penalty
            self.q_table["DISTRACTED"]["media"] = 0.3
            self.q_table["DISTRACTED"]["work"] = 0.8
            
        # 3. Choose action using Epsilon-Greedy strategy
        state_q = self.q_table[self.state]
        if random.random() < 0.10: # 10% Exploration rate
            action = random.choice(["work", "chat", "media", "idle"])
        else: # 90% Exploitation
            action = max(state_q, key=state_q.get)
            
        # 4. State transition
        if action == "work":
            self.state = "FOCUSED"
        elif action == "chat":
            self.state = "COLLABORATING"
        elif action == "media":
            self.state = "DISTRACTED"
        else:
            self.state = "IDLE"
            
        # 5. Map action state to realistic application and bandwidth
        app_name = "System Idle"
        bandwidth = 0.01
        status = "Idle"
        
        if self.state == "FOCUSED":
            if self.dept == "Engineering":
                app_name = "Git (Code Commit & Pull)" if random.random() > 0.4 else "Jira & Confluence Board"
                bandwidth = random.uniform(0.6, 2.2)
            elif self.dept == "IT Ops":
                app_name = "Intranet Database Query (SQL)"
                bandwidth = random.uniform(1.5, 3.8)
            else:
                app_name = "Outlook Mail Sync"
                bandwidth = random.uniform(0.08, 0.6)
            status = "Active"
            
        elif self.state == "COLLABORATING":
            app_name = "Microsoft Teams (Audio Call)" if random.random() > 0.5 else "Slack Chat Client"
            bandwidth = random.uniform(1.2, 4.2) if "Teams" in app_name else random.uniform(0.05, 0.25)
            status = "Active"
            
        elif self.state == "DISTRACTED":
            if block_streaming:
                app_name = "YouTube (4K Video Stream) [THROTTLED BY FW]" if random.random() > 0.4 else "Facebook Video [THROTTLED]"
                bandwidth = random.uniform(0.4, 1.1)
                status = "Throttled"
            elif scavenger_qos:
                app_name = "High-Volume Bittorrent Download [QoS SHAPED]"
                bandwidth = random.uniform(1.0, 2.2)
                status = "Throttled"
            else:
                apps = ["YouTube (4K Video Stream)", "Facebook & Instagram Video Scrolling", "High-Volume Bittorrent Download", "Large OS Dataset Download (ISO)"]
                app_name = random.choice(apps)
                bandwidth = random.uniform(28.0, 48.0) if "YouTube" in app_name else random.uniform(50.0, 95.0)
                status = "Abuse"
                
        else: # IDLE
            app_name = "System Idle"
            bandwidth = random.uniform(0.0, 0.04)
            status = "Idle"
            
        return {
            "state": self.state,
            "action": action,
            "application": app_name,
            "bandwidth_mbps": round(bandwidth, 2),
            "status": status
        }
