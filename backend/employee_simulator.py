import random
import time
from typing import Any
from backend.ml_behavior import EmployeeRLAgent

# Registry to keep employee agents persistent so they maintain state and Q-values
AGENT_REGISTRY: dict[str, EmployeeRLAgent] = {}

# Seed lists for generating realistic employee activity
FIRST_NAMES = [
    "Aarav", "Aditya", "Amit", "Alwin", "Ananya", "Arjun", "Deepak", "Divya", "Ishaan", "Karan", 
    "Kabir", "Meera", "Neha", "Pooja", "Pranav", "Priya", "Rahul", "Rohan", "Ramesh", "Sanjay", 
    "Sneha", "Suresh", "Tanvi", "Vikram", "Vivek", "Yash", "Kriti", "Riya", "Mohit", "Preeti"
]

LAST_NAMES = [
    "Sharma", "Verma", "Gupta", "Patel", "Kumar", "Singh", "Joshi", "Mehta", "Reddy", "Nair", 
    "Rao", "Iyer", "Choudhury", "Das", "Banerjee", "Sen", "Mishra", "Pandey", "Saxena", "Roy"
]

ROLES = [
    {"role": "Software Engineer", "dept": "Engineering"},
    {"role": "Senior Developer", "dept": "Engineering"},
    {"role": "QA Analyst", "dept": "Quality Assurance"},
    {"role": "Product Manager", "dept": "Product"},
    {"role": "HR Specialist", "dept": "Human Resources"},
    {"role": "Database Administrator", "dept": "IT Ops"},
    {"role": "System Administrator", "dept": "IT Ops"},
    {"role": "Network Engineer", "dept": "NetOps"},
    {"role": "Finance Executive", "dept": "Finance"},
    {"role": "Data Scientist", "dept": "Data Science"},
    {"role": "Security Analyst", "dept": "SecOps"},
    {"role": "Content Designer", "dept": "Design"}
]

NORMAL_APPS = [
    {"name": "Microsoft Teams (Audio Call)", "bw_min": 0.5, "bw_max": 2.0, "status": "Active"},
    {"name": "Microsoft Teams (Screen Share)", "bw_min": 1.5, "bw_max": 5.0, "status": "Active"},
    {"name": "Outlook Mail Sync", "bw_min": 0.05, "bw_max": 0.5, "status": "Active"},
    {"name": "Jira & Confluence Board", "bw_min": 0.1, "bw_max": 0.8, "status": "Active"},
    {"name": "Git (Code Commit & Pull)", "bw_min": 0.2, "bw_max": 1.5, "status": "Active"},
    {"name": "Intranet Database Query (SQL)", "bw_min": 0.5, "bw_max": 3.0, "status": "Active"},
    {"name": "Slack Chat Client", "bw_min": 0.01, "bw_max": 0.1, "status": "Active"},
    {"name": "General Web Browsing", "bw_min": 0.1, "bw_max": 1.2, "status": "Active"},
    {"name": "System Idle", "bw_min": 0.0, "bw_max": 0.01, "status": "Idle"}
]

ABUSE_APPS = [
    {"name": "YouTube (4K Video Stream)", "bw_min": 25.0, "bw_max": 45.0, "status": "Abuse"},
    {"name": "Facebook & Instagram Video Scrolling", "bw_min": 8.0, "bw_max": 15.0, "status": "Abuse"},
    {"name": "High-Volume Bittorrent Download", "bw_min": 50.0, "bw_max": 90.0, "status": "Abuse"},
    {"name": "Large OS Dataset Download (ISO)", "bw_min": 40.0, "bw_max": 75.0, "status": "Abuse"},
    {"name": "Unauthorized Crypto Mining Node", "bw_min": 15.0, "bw_max": 25.0, "status": "Abuse"},
    {"name": "Bulk Intranet DB Backup Sync", "bw_min": 60.0, "bw_max": 110.0, "status": "Abuse"}
]

BRANCH_ROLES = {
    "hub-delhi": {"role": "Corporate Operations Headquarters", "type": "HQ"},
    "dc-mumbai": {"role": "Primary Enterprise Data Center", "type": "DC"},
    "branch-bengaluru": {"role": "XYZ R&D Development Center", "type": "DEV"},
    "branch-chennai": {"role": "Enterprise Product Engineering Hub", "type": "DEV"},
    "branch-hyderabad": {"role": "Cloud Security Operations Center", "type": "DEV"},
    "branch-pune": {"role": "XYZ Smart Manufacturing Plant", "type": "MFG"},
    "branch-ahmedabad": {"role": "Advanced IoT CNC Foundry", "type": "MFG"},
    "branch-kolkata": {"role": "Regional Supply Chain Headquarters", "type": "HQ"},
    "branch-bhubaneswar": {"role": "Automated Logistics Hub", "type": "LOG"},
    "branch-guwahati": {"role": "North-East Operations Terminal", "type": "LOG"},
    "branch-chandigarh": {"role": "Regional Sales & Executive Hub", "type": "HQ"},
    "branch-jaipur": {"role": "Satellite Dev & QA Outpost", "type": "DEV"},
    "branch-lucknow": {"role": "Billing & Customer Operations Hub", "type": "HQ"},
    "branch-kochi": {"role": "XYZ Branch R&D Center", "type": "DEV"},
    "branch-nagpur": {"role": "Central RFID Supply Chain Hub", "type": "LOG"},
    "branch-bhopal": {"role": "Central IoT Inventory Depot", "type": "LOG"}
}

def get_branch_assets_and_subnets(branch_id: str) -> dict[str, Any]:
    """Returns subnets and hardware assets for the given branch."""
    idx = sum(ord(c) for c in branch_id) % 240 + 10
    
    subnets = [
        {"name": "Voice Subnet (VoIP)", "cidr": f"10.{idx}.20.0/23", "allocated": "98 IPs", "vlan": 20},
        {"name": "Workstation Subnet (DHCP)", "cidr": f"10.{idx}.10.0/22", "allocated": "142 IPs", "vlan": 10},
        {"name": "IoT & CNC Sensor Grid", "cidr": f"10.{idx}.30.0/24", "allocated": "56 IPs", "vlan": 30},
        {"name": "CCTV Security Network", "cidr": f"10.{idx}.40.0/24", "allocated": "24 IPs", "vlan": 40},
        {"name": "Out-of-Band Management", "cidr": f"10.{idx}.1.0/24", "allocated": "5 IPs", "vlan": 99}
    ]
    
    # Seed switch CPU metrics based on branch status to look realistic
    random.seed(branch_id)
    assets = [
        {
            "name": "Edge PE Router",
            "model": "Juniper MX240 3D Universal Edge",
            "serial": f"JNPR-MX-{random.randint(100000, 999999)}",
            "firmware": "Junos OS 21.4R3-S5",
            "cpu_util_pct": random.randint(15, 32),
            "memory_util_pct": random.randint(40, 52),
            "status": "ONLINE"
        },
        {
            "name": "Branch Firewall",
            "model": "Fortinet FortiGate 100F NGFW",
            "serial": f"FG100F-{random.randint(100000, 999999)}",
            "firmware": "FortiOS 7.2.5",
            "cpu_util_pct": random.randint(18, 36),
            "memory_util_pct": random.randint(45, 58),
            "status": "ONLINE"
        },
        {
            "name": "Core Layer Switch",
            "model": "Cisco Catalyst 9300 48-Port UPOE",
            "serial": f"C9300-L-{random.randint(100000, 999999)}",
            "firmware": "Cisco IOS-XE 17.9.4",
            "cpu_util_pct": random.randint(8, 22),
            "memory_util_pct": random.randint(30, 42),
            "status": "ONLINE"
        }
    ]
    random.seed(None)
    role_info = BRANCH_ROLES.get(branch_id, {"role": "Standard Branch Office", "type": "DEV"})
    return {
        "role": role_info["role"],
        "type": role_info["type"],
        "subnets": subnets,
        "assets": assets
    }

def generate_employee_activity(branch_id: str, branch_status: str, active_incidents: list[dict] | None = None, policies: dict | None = None) -> list[dict[str, Any]]:
    """
    Generates a live list of 60 to 120 employees at the branch using Reinforcement Learning Q-Agents.
    """
    # Policies check
    block_streaming = policies.get("block_streaming", False) if policies else False
    scavenger_qos = policies.get("scavenger_qos", False) if policies else False
    
    # We want consistent seed for roster generation, but let state progression run
    # Let's seed with branch_id just once to get the stable employee names
    random.seed(branch_id)
    num_employees = random.randint(60, 120)
    
    # Pre-generate names, roles, IPs just to look stable
    roster_templates = []
    for i in range(num_employees):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        name = f"{first} {last}"
        role_info = random.choice(ROLES)
        
        dev_type = "LAPTOP" if i % 2 == 0 else "WORKSTATION"
        dev_num = 100 + i
        device_id = f"{branch_id.replace('branch-', '').upper()}-{dev_type}-{dev_num}"
        local_ip = f"10.{random.randint(10, 80)}.{random.randint(1, 254)}.{dev_num}"
        
        roster_templates.append({
            "name": name,
            "role": role_info["role"],
            "dept": role_info["dept"],
            "device_id": device_id,
            "ip_address": local_ip
        })
    random.seed(None) # Reset seed
    
    # Resolve node metrics or simulate latency to feed as state inputs to RL agents
    # If branch status is Warning or Critical, simulate high baseline latency
    latency = 12.0
    if branch_status.upper() == "CRITICAL":
        latency = 180.0
    elif branch_status.upper() in ("WARNING", "DEGRADED"):
        latency = 75.0
        
    employees = []
    for i, temp in enumerate(roster_templates):
        agent_key = f"{branch_id}-{temp['name']}-{i}"
        
        # Instantiate agent in global registry if not present
        if agent_key not in AGENT_REGISTRY:
            AGENT_REGISTRY[agent_key] = EmployeeRLAgent(agent_key, temp["role"], temp["dept"])
            
        agent = AGENT_REGISTRY[agent_key]
        
        # Execute RL step!
        res = agent.step(latency, block_streaming, scavenger_qos)
        
        employees.append({
            "name": temp["name"],
            "role": temp["role"],
            "department": temp["dept"],
            "device_id": temp["device_id"],
            "ip_address": temp["ip_address"],
            "active_application": res["application"],
            "bandwidth_mbps": res["bandwidth_mbps"],
            "status": res["status"],
            "timestamp": time.strftime("%H:%M:%S")
        })
        
    # Sort so abusers/throttled show at the top of the grid
    employees.sort(key=lambda x: 0 if x["status"] == "Abuse" else 1 if x["status"] == "Throttled" else 2)
    return employees
