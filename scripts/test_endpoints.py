import urllib.request
import json
import sys

def test_endpoint(url, method="GET", data=None):
    try:
        req = urllib.request.Request(url, method=method)
        if data:
            req.add_header("Content-Type", "application/json")
            req_data = json.dumps(data).encode("utf-8")
        else:
            req_data = None
            
        with urllib.request.urlopen(req, data=req_data, timeout=5) as response:
            res = json.loads(response.read().decode("utf-8"))
            return True, res
    except Exception as e:
        return False, str(e)

def main():
    endpoints = [
        ("Health Endpoint", "http://127.0.0.1:8000/health", "GET", None),
        ("Summary Endpoint", "http://127.0.0.1:8000/summary", "GET", None),
        ("Topology Preview", "http://127.0.0.1:8000/topology", "GET", None),
        ("Branches Endpoint", "http://127.0.0.1:8000/branches", "GET", None),
        ("Branch Detail (Bengaluru)", "http://127.0.0.1:8000/branches/branch-bengaluru", "GET", None),
        ("Alerts Endpoint", "http://127.0.0.1:8000/alerts", "GET", None),
        ("Reports (Executive)", "http://127.0.0.1:8000/reports?report_type=executive", "GET", None),
        ("Copilot Query", "http://127.0.0.1:8000/copilot/query", "POST", {"question": "What is likely to fail next?"})
    ]
    
    print("====================================================")
    print("           NOC COPILOT API ENDPOINT TEST            ")
    print("====================================================")
    
    for name, url, method, payload in endpoints:
        print(f"\nTesting {name} ({method} {url})...")
        success, res = test_endpoint(url, method, payload)
        if success:
            print("Status: SUCCESS")
            if name == "Topology Preview":
                # Topology is huge, just print summary info
                print(f"Keys: {list(res.keys())}")
                print(f"Total Nodes: {len(res.get('nodes', {}))}")
                print(f"Total Edges: {len(res.get('edges', []))}")
            elif name == "Branches Endpoint":
                print(f"Keys: {list(res.keys())}")
                print(f"Total Branches: {len(res.get('branches', []))}")
                print(f"First Branch: {res.get('branches', [])[0] if res.get('branches') else 'None'}")
            elif name == "Alerts Endpoint":
                print(f"Keys: {list(res.keys())}")
                print(f"Total Alerts: {len(res.get('alerts', []))}")
                print(f"First Alert: {res.get('alerts', [])[0] if res.get('alerts') else 'None'}")
            else:
                print(json.dumps(res, indent=2)[:800])
                if len(json.dumps(res, indent=2)) > 800:
                    print("... [truncated]")
        else:
            print(f"Status: FAILED")
            print(f"Error: {res}")

if __name__ == "__main__":
    main()
