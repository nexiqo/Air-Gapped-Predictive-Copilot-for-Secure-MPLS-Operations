# Devin Build Brief

## Mission

Take the current offline-first NOC Copilot MVP and turn it into a full hackathon-grade product for ISRO Challenge 13.

The final system must run fully offline and feel like a serious network operations platform, not a simple dashboard. The product should be visual, topology-driven, and text-heavy in the way real NOC operators work. The UI should feel inspired by a graph or ontology platform, with network entities connected visibly and every important state readable as text.

## Non-Negotiable Product Goals

1. Everything must run offline.
2. The main interface must be topology-first, like a connected map or graph of the network.
3. Risks, current issues, predicted issues, latency, packet loss, tunnel health, and routing instability must be shown in text, not only as charts.
4. There must be an offline copilot that predicts future problems and explains them in operator-ready language.
5. Every branch, hub, tunnel, and core site must be clickable and drillable.
6. There must be a report section with detailed branch-wise and network-wide summaries.
7. The UI should feel inspired by Palantir-style ontology/graph systems, but without copying branding.

## Product Direction

Build the UI around a live network topology canvas:

- nodes = hub, branches, dc-core, tunnels, services, controllers
- edges = MPLS paths, SD-WAN overlays, routing adjacencies, service dependencies
- node labels = branch name, health, current risk, predicted risk, latency, utilization, status
- edge labels = loss, jitter, latency, path health, route state, predicted breach ETA

The operator should understand the state of the entire network from the topology view alone.

## Core Screens

### 1. Topology Map View

This is the primary screen and should open by default.

Must include:

- a map-like or graph-like network structure with visible connected lines
- clearly visible hubs, branches, datacenter, and tunnels
- color-coded health states
- textual badges on each node and edge
- predicted issue callouts directly on the graph
- visible relationship lines between network entities
- ability to zoom, pan, and click nodes
- ability to open branch details from the topology itself

The graph should not be a decorative diagram. It should function as the main operational surface.

## Proper UI Structure

Design the product as a multi-panel operator cockpit with a graph-first center.

### Primary Layout

Use a desktop-first application shell with this structure:

- `Top Header`
- `Left Navigation Rail`
- `Center Topology Canvas`
- `Right Insight / Detail Panel`
- `Bottom Event / Timeline / Metrics Strip`
- `Floating Copilot Button and Expandable Copilot Panel`

### Header

The top header should contain:

- product name
- offline status badge
- current simulation status
- current most critical issue
- next likely failure ETA
- global search / command access point if needed

### Left Navigation Rail

The left navigation should contain:

- `Overview`
- `Topology`
- `Branches`
- `Alerts`
- `Predictions`
- `Reports`
- `Copilot`
- `Settings`

This rail should be compact but always visible.

### Center Topology Canvas

This is the main interaction surface.

The center panel must show:

- graph/map network structure
- branches, hub, datacenter, tunnels, services
- visible connected lines
- edge state labels
- node state labels
- visual highlighting of impacted or at-risk components

### Right Insight Panel

This panel changes based on selection and context.

It should support:

- selected branch details
- selected link details
- selected alert details
- selected predicted issue details
- runbook and remediation details

The panel should be collapsible but open by default on node selection.
 

- alert/event timeline
- recent incident feed
- anomaly score trend
- traffic trend
- route flap markers
- prediction lead-time markers

This can include graphs, but text summaries should still be present.

### Floating Copilot Button

Place a clear button on screen such as:

- `Ask Copilot`
- `Search`
- `Command`

When clicked, it opens the copilot/search panel.

## Page and Route Structure

If using React or another SPA, use a route structure like:

- `/` or `/overview`
- `/topology`
- `/branches`
- `/branches/:branchId`
- `/alerts`
- `/predictions`
- `/reports`
- `/copilot`

If using Streamlit, mirror this with pages or tabs.

## Detailed Screen Structure

### Overview Page

Purpose:

- give a shift-summary view of the entire network

Sections:

- global risk summary
- next likely failures
- high-risk branch cards
- active alerts table
- compact topology preview
- recent copilot findings

### Topology Page

Purpose:

- serve as the main operational graph screen

Sections:

- full topology graph
- graph controls
- filters for severity, branch, issue type, overlay/underlay
- detail drawer for selected node or link
- textual risk summary for the selected item

### Branches Page

Purpose:

- list all branches and let operators compare them quickly

Sections:

- branch table
- branch cards
- health badges
- predicted issue text
- quick action to open branch details

### Single Branch Page

Purpose:

- deep dive into one branch

Sections:

- branch overview
- current metrics in text
- incidents and events
- connected services and links
- future predicted issue
- recommended operator actions
- mini topology view centered on that branch

### Alerts Page

Purpose:

- show live and recent alerts

Sections:

- severity filters
- alert list
- confidence score
- affected entity
- ETA to impact
- acknowledgement status if implemented

### Predictions Page

Purpose:

- show forecasted problems, not just current alarms

Sections:

- predicted issue queue
- affected branch or link
- confidence
- ETA
- reasoning
- remediation suggestion
- evidence source

### Reports Page

Purpose:

- provide readable judge-facing and operator-facing reporting

Sections:

- executive summary
- network-wide report
- branch report
- incident report
- prediction report
- validation report

## Component Structure

If building in React, organize components roughly like this:

- `AppShell`
- `HeaderBar`
- `NavRail`
- `TopologyCanvas`
- `TopologyNode`
- `TopologyEdge`
- `GraphLegend`
- `FilterToolbar`
- `DetailsPanel`
- `BranchDetailCard`
- `LinkDetailCard`
- `PredictionPanel`
- `AlertTimeline`
- `MetricStrip`
- `CopilotFab`
- `CopilotDrawer`
- `CopilotMessageList`
- `CopilotQueryInput`
- `ReportView`
- `EntityRelationshipPanel`

## Data Shaping for the UI

The frontend should receive graph-shaped data from the backend.

Suggested topology response shape:

```json
{
  "nodes": [
    {
      "id": "branch-a",
      "type": "branch",
      "label": "Branch A",
      "status": "warning",
      "metrics": {
        "latency_ms": 42,
        "packet_loss_pct": 2.1,
        "utilization_pct": 71
      },
      "prediction": {
        "issue": "congestion_buildup",
        "confidence": 0.82,
        "eta_minutes": 9
      }
    }
  ],
  "edges": [
    {
      "id": "hub1-branch-a",
      "source": "hub1",
      "target": "branch-a",
      "status": "degrading",
      "metrics": {
        "latency_ms": 38,
        "jitter_ms": 7,
        "packet_loss_pct": 1.8
      }
    }
  ]
}
```

## Chatbot / Copilot Structure

The chatbot must feel like an offline operations copilot, not a casual assistant.


- question input
- send button
- recent suggested prompts
- response cards
- evidence sources
- structured output blocks

### Copilot Suggested Prompts

Show quick prompts like:

- `What is likely to fail next?`
- `Why is Branch A at risk?`
- `Show high-risk tunnels`
- `Which branch is closest to SLA breach?`
- `Summarize the current network state`

### Copilot Response Structure

Each response should be rendered as sections, not as one plain paragraph.

Use:

- `Predicted Issue`
- `Current State`
- `Why This Is Risky`
- `Affected Scope`
- `Time To Impact`
- `Recommended Actions`
- `Evidence`

### Chatbot UX Rules

- answers must be concise and operator-focused
- avoid long conversational fluff
- always ground answers in local data
- if uncertain, say what is unknown
- when possible, link the answer to a graph entity the user can click

### Chatbot Output Example
### Interaction Model

Use a slide-out drawer, modal, or docked side panel.

The copilot UI should contain:

```text
Predicted Issue:
Congestion buildup on hub1-branch-a

Current State:
Latency is elevated to 42 ms, utilization is 71%, and queue depth is rising.

Why This Is Risky:
The link shows the same precursor pattern seen in prior congestion scenarios.

Affected Scope:
Branch A user traffic and hub-to-branch application flows

Time To Impact:
Estimated 9 minutes

Recommended Actions:
Prioritize critical traffic, inspect QoS saturation, and validate alternate path availability.

Evidence:
RB-002, Topology Notes, INC-001
```

## Visual Behavior Requirements

The UI must visibly connect information.

Required behaviors:

- clicking a node highlights related edges
- clicking an alert highlights the affected branch or path in the graph
- clicking a prediction centers the graph on the impacted entity
- clicking a runbook link opens the related remediation detail
- hovering a line shows line-level metrics and risk

## Report UI Structure

Each report page should have:

- report header
- summary paragraph
- branch or issue table
- evidence section
- recommendations section
- optional export action

Suggested reports:

- `Executive Summary Report`
- `Branch Health Report`
- `Prediction Readiness Report`
- `Incident and Alert Report`
- `Validation and Lead-Time Report`

## UI Completion Criteria

The UI is complete only when:

1. the topology view is the strongest and most useful screen
2. important metrics are visible as text on nodes, lines, or panels
3. the copilot can be opened with one click
4. the operator can ask questions and get structured grounded answers
5. the operator can click a branch and understand its state immediately
6. the reports section is present and usable
7. the whole experience feels like a connected operational system

### 2. Branch Detail Panel

When a branch or node is clicked, open a detail drawer, modal, or side panel showing:

- branch name
- current status
- current latency
- jitter
- packet loss
- bandwidth utilization
- tunnel health
- route stability
- recent incidents
- predicted next problem
- estimated time to impact
- recommended actions

This section should be primarily text-first, with small supporting visuals if helpful.

### 3. Copilot Search / Ask Panel

There must be a button that opens the search bar or ask-copilot panel.

Behavior:

Examples:

- "Why is Branch A at risk?"
- "What is likely to fail next?"
- "Show all high-risk tunnels."
- "Which site is most likely to breach SLA in the next 10 minutes?"

### 4. Global Risk / Situation Summary

Add a clear text summary area for the overall network:

- current most critical issue
- most at-risk branch
- next likely failure
- ETA to breach
- overall network health summary
- alert count by severity

This should read like an operator shift summary, not a generic dashboard KPI strip.

### 5. Reports Section

There must be a dedicated reports page or tab.

Must include:

- branch-wise network reports
- incident summaries
- current network-wide health report
- predicted upcoming problem report
- recommended remediation report
- historical validation / scenario report

Each report should be exportable or at least easy to present to judges.

## UI Style Requirements

### Overall Feel

- serious mission-control style
- information-dense but readable
- topology/ontology inspired
- strong emphasis on connected systems
- dark mode is acceptable, but readability matters more than aesthetics
- avoid generic startup-dashboard look

### Visual Language

- nodes and edges must be visually connected and easy to read
- br
- search panel should stay hidden or minimized until the operator clicks the button
- once opened, the operator can ask natural-language questions
- answers must be grounded only in offline/local data
- answers must include current state, predicted issue, reasoning, affected scope, and recommended action
anch states should be obvious at a glance
- text overlays should show real metrics and predictions
- alerts should feel operational, not decorative
- graph should feel alive and analytical

### Text-First Requirement

Show critical metrics as text on screen:

- latency
- jitter
- loss
- utilization
- routing risk
- predicted problem
- ETA
- confidence
- severity

Do not hide everything behind charts.

Charts can exist, but the operator should still understand the state from text alone.

## Functional Requirements

### Offline Copilot

Must:

- run without cloud APIs
- use local model only if an LLM is used
- fall back to deterministic grounded text generation if model is unavailable
- answer using local runbooks, local topology context, local incident history, and local telemetry

Copilot output format should include:

- predicted issue
- confidence
- root-cause hypothesis
- affected scope
- estimated time to impact
- recommended actions
- evidence sources

### Prediction Surface

The UI must show both:

- current issues
- future likely issues

Predicted issues should appear:

- on the graph
- in the branch detail panel
- in the global summary
- in the reports section
- in copilot responses

### Branch Drill-Down

Each branch must be expandable with:

- operational summary
- live metrics
- dependency links
- risk explanation
- history or recent event trail

### Graph Connections

The visible graph should show links between:

- hub and branches
- branches and data center
- underlay and overlay paths
- incidents and affected entities
- runbooks and issue types if useful

The user asked for a visible “connected by lines” experience. This is mandatory.

## Data Model Guidance

Represent the system as entities and relationships:

- `Site`
- `Branch`
- `Hub`
- `DataCenter`
- `Tunnel`
- `Link`
- `Incident`
- `Prediction`
- `MetricSnapshot`
- `Runbook`
- `Service`

Relationships:

- `CONNECTED_TO`
- `DEPENDS_ON`
- `AFFECTS`
- `PREDICTED_TO_IMPACT`
- `MITIGATED_BY`

This will help produce the ontology-like feel the user wants.

## Technical Direction

### Frontend

Recommended:

- React front end or a richer Streamlit replacement if needed
- graph library such as React Flow, Cytoscape, Sigma, or D3
- side panel for node drill-down
- floating or docked copilot search button

If Streamlit cannot deliver the topology-first product well, replace it with a small React app and keep FastAPI as the backend.

### Backend

Keep FastAPI and extend it.

Add endpoints for:

- full topology graph data
- branch detail data
- network summary data
- reports data
- copilot query
- alert feed
- prediction feed

### Data / ML

Replace the current demo-only baseline with:

- real telemetry ingestion
- anomaly scoring
- fault classification
- time-to-impact estimation

## Required Backend Endpoints

Add or improve endpoints like:

- `GET /health`
- `GET /topology`
- `GET /summary`
- `GET /branches`
- `GET /branches/{branch_id}`
- `GET /alerts`
- `GET /reports`
- `POST /analyze`
- `GET /query`

## Report Requirements

The reports section should include:

### Network Overview Report

- overall health
- critical incidents
- top risks
- next likely failures

### Incident / Prediction Report

- active incidents
- forecasted incidents
- confidence and ETA
- remediation suggestions

### Validation Report

- scenario tested
- whether predicted in time
- lead time
- m
### Branch Report

- branch-by-branch health
- latency, loss, utilization
- recent events
- predicted risk
odel confidence
- recommended action quality

## Acceptance Criteria

The build is only complete when all of the following are true:

1. The app runs fully offline.
2. The main page is a connected topology/graph view.
3. Each branch can be clicked to open details.
4. Current problems are visible as text.
5. Future predicted problems are visible as text.
6. There is a button to open the ask/search copilot panel.
7. Copilot answers are grounded and local-only.
8. A reports section exists with branch-wise and global summaries.
9. The network graph visibly shows connections between components.
10. The product looks like a real NOC platform, not a toy dashboard.

## Order of Work

### Phase 1

- implement `GET /topology`, `GET /summary`, `GET /branches`, `GET /reports`
- normalize backend data model into entities and relationships

### Phase 2

- build topology-first UI
- add node/edge labels and branch drill-down
- add network summary strip

### Phase 3

- add copilot button and expandable query panel
- connect copilot answers to local evidence and predictions

### Phase 4

- build reports section
- add export-friendly layouts

### Phase 5

- polish visual system
- improve graph readability
- make the experience feel like a graph/ontology-driven operations platform

## Exact Instruction for Devin

Use the current repo as a starting point, but redesign the frontend around a topology-first offline NOC cockpit.

The UI must have:

- a map/graph-like connected network view
- visible lines between entities
- clickable branches and links
- text-first display of latency, loss, utilization, risk, and predicted issues
- an offline copilot with a button-triggered search/ask panel
- a reports section with branch-wise and network-wide reports
- a visual style inspired by ontology/graph platforms, similar in spirit to Palantir-style operational systems

Do not build a generic dashboard. Build an offline, graph-centric, operator-facing command surface.
