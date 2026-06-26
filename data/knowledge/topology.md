# Topology Notes

- `hub1` acts as the central hub and primary aggregation point.
- `branch-a` carries the most latency-sensitive branch traffic.
- `branch-b` is the secondary branch and a useful site for drift scenarios.
- `dc-core` hosts critical services and represents the datacenter edge.
- The `hub1 <-> branch-a` path is the highest business-impact link in the synthetic demo.
