# State Management

<cite>
**Referenced Files in This Document**
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)
- [dashboard-workspace.tsx](file://apps/hr-suite/components/dashboard/dashboard-workspace.tsx)
- [dashboard-progress-model.ts](file://apps/hr-suite/components/dashboard/dashboard-progress-model.ts)
- [widget-picker-model.ts](file://apps/hr-suite/components/dashboard/widget-picker-model.ts)
- [hera-chat-state.ts](file://apps/hr-suite/components/hera/hera-chat-state.ts)
- [hera-floating-state.ts](file://apps/hr-suite/components/hera/hera-floating-state.ts)
- [hera-request.ts](file://apps/hr-suite/components/hera/hera-request.ts)
- [hera-response-model.ts](file://apps/hr-suite/components/hera/hera-response-model.ts)
- [hera-chat.tsx](file://apps/hr-suite/components/hera/hera-chat.tsx)
- [hera-control-card.tsx](file://apps/hr-suite/components/hera/hera-control-card.tsx)
- [hera-scope-line.tsx](file://apps/hr-suite/components/hera/hera-scope-line.tsx)
- [hera-settings.tsx](file://apps/hr-suite/components/hera/hera-settings.tsx)
- [employee-dashboard.tsx](file://apps/hr-suite/components/employees/employee-dashboard.tsx)
- [employee-list.tsx](file://apps/hr-suite/components/employees/employee-list.tsx)
- [employee-person-card.tsx](file://apps/hr-suite/components/employees/employee-person-card.tsx)
- [hr-calendar-page-size-select.tsx](file://apps/hr-suite/components/hr-calendar/hr-calendar-page-size-select.tsx)
- [hr-month-calendar.tsx](file://apps/hr-suite/components/hr-calendar/hr-month-calendar.tsx)
- [route.ts](file://apps/hr-suite/app/api/employees/route.ts)
- [route.ts](file://apps/hr-suite/app/api/dashboards/route.ts)
- [route.ts](file://apps/hr-suite/app/api/hera/conversations/route.ts)
- [route.ts](file://apps/hr-suite/app/api/hera/memory/route.ts)
- [route.ts](file://apps/hr-suite/app/api/preferences/employees/route.ts)
- [route.ts](file://apps/hr-suite/app/api/settings/dashboard-widgets/route.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document explains LiquidHR’s frontend state management strategy with a focus on:
- React Context for global state and cross-cutting concerns
- Custom hooks for local component state and data fetching
- Model-based components that encapsulate behavior and state (e.g., DashboardWorkspaceModel, HeraChatState)
- Clear separation between server state (Supabase via Next.js API routes) and client state (React)
- Caching strategies, optimistic updates, and error handling patterns
- Real-time employee updates and AI chat interactions
- Performance considerations for large datasets and synchronization across components

The goal is to provide both a conceptual overview and code-level guidance so developers can implement consistent, performant, and maintainable stateful features.

## Project Structure
LiquidHR organizes state-related logic into three primary layers:
- UI Components: Presentational and container components that render the UI and manage local state
- Models: Encapsulate business logic and state transitions for complex features (e.g., dashboard workspace, chat state)
- Data Layer: Next.js API routes that proxy requests to Supabase and return normalized responses

```mermaid
graph TB
subgraph "UI Components"
DWS["Dashboard Workspace"]
HC["Hera Chat"]
EL["Employee List"]
EPC["Employee Person Card"]
end
subgraph "Models"
DWModel["DashboardWorkspaceModel"]
HCS["HeraChatState"]
WPM["WidgetPickerModel"]
DPM["DashboardProgressModel"]
end
subgraph "Data Layer"
APIEmp["/api/employees"]
APIDash["/api/dashboards"]
APIConv["/api/hera/conversations"]
APIMem["/api/hera/memory"]
APIPref["/api/preferences/employees"]
APISet["/api/settings/dashboard-widgets"]
end
DWS --> DWModel
HC --> HCS
EL --> APIEmp
EPC --> APIEmp
DWS --> APIDash
HC --> APIConv
HC --> APIMem
EL --> APIPref
DWS --> APISet
```

**Diagram sources**
- [dashboard-workspace.tsx](file://apps/hr-suite/components/dashboard/dashboard-workspace.tsx)
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)
- [hera-chat.tsx](file://apps/hr-suite/components/hera/hera-chat.tsx)
- [hera-chat-state.ts](file://apps/hr-suite/components/hera/hera-chat-state.ts)
- [employee-list.tsx](file://apps/hr-suite/components/employees/employee-list.tsx)
- [employee-person-card.tsx](file://apps/hr-suite/components/employees/employee-person-card.tsx)
- [route.ts](file://apps/hr-suite/app/api/employees/route.ts)
- [route.ts](file://apps/hr-suite/app/api/dashboards/route.ts)
- [route.ts](file://apps/hr-suite/app/api/hera/conversations/route.ts)
- [route.ts](file://apps/hr-suite/app/api/hera/memory/route.ts)
- [route.ts](file://apps/hr-suite/app/api/preferences/employees/route.ts)
- [route.ts](file://apps/hr-suite/app/api/settings/dashboard-widgets/route.ts)

**Section sources**
- [dashboard-workspace.tsx](file://apps/hr-suite/components/dashboard/dashboard-workspace.tsx)
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)
- [hera-chat.tsx](file://apps/hr-suite/components/hera/hera-chat.tsx)
- [hera-chat-state.ts](file://apps/hr-suite/components/hera/hera-chat-state.ts)
- [employee-list.tsx](file://apps/hr-suite/components/employees/employee-list.tsx)
- [employee-person-card.tsx](file://apps/hr-suite/components/employees/employee-person-card.tsx)
- [route.ts](file://apps/hr-suite/app/api/employees/route.ts)
- [route.ts](file://apps/hr-suite/app/api/dashboards/route.ts)
- [route.ts](file://apps/hr-suite/app/api/hera/conversations/route.ts)
- [route.ts](file://apps/hr-suite/app/api/hera/memory/route.ts)
- [route.ts](file://apps/hr-suite/app/api/preferences/employees/route.ts)
- [route.ts](file://apps/hr-suite/app/api/settings/dashboard-widgets/route.ts)

## Core Components
Key model-based components centralize state and behavior:
- DashboardWorkspaceModel: Manages dashboard layout, widget configuration, and progress tracking
- WidgetPickerModel: Handles selection and ordering of widgets within dashboards
- DashboardProgressModel: Tracks loading and completion states for widget rendering
- HeraChatState: Encapsulates conversation lifecycle, message history, streaming responses, and memory integration

These models are consumed by their respective UI components to keep presentation logic separate from stateful behavior.

**Section sources**
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)
- [widget-picker-model.ts](file://apps/hr-suite/components/dashboard/widget-picker-model.ts)
- [dashboard-progress-model.ts](file://apps/hr-suite/components/dashboard/dashboard-progress-model.ts)
- [hera-chat-state.ts](file://apps/hr-suite/components/hera/hera-chat-state.ts)

## Architecture Overview
LiquidHR follows a clear separation between server state and client state:
- Server state lives in Supabase and is accessed through Next.js API routes
- Client state resides in React components and models, often using Context or custom hooks
- Models act as intermediaries that coordinate UI state and server interactions
- Real-time updates are handled via subscriptions or polling where applicable

```mermaid
sequenceDiagram
participant UI as "UI Component"
participant Model as "Model (e.g., DashboardWorkspaceModel)"
participant API as "Next.js API Route"
participant DB as "Supabase"
UI->>Model : Trigger action (e.g., update widget order)
Model->>API : POST/PUT request with payload
API->>DB : Persist changes
DB-->>API : Success response
API-->>Model : Normalized result
Model->>Model : Update local state optimistically
Model-->>UI : Re-render with updated state
```

**Diagram sources**
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)
- [dashboard-workspace.tsx](file://apps/hr-suite/components/dashboard/dashboard-workspace.tsx)
- [route.ts](file://apps/hr-suite/app/api/dashboards/route.ts)

**Section sources**
- [dashboard-workspace.tsx](file://apps/hr-suite/components/dashboard/dashboard-workspace.tsx)
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)
- [route.ts](file://apps/hr-suite/app/api/dashboards/route.ts)

## Detailed Component Analysis

### DashboardWorkspaceModel
Responsibilities:
- Maintain dashboard configuration and widget list
- Coordinate widget picker interactions and ordering
- Track progress for asynchronous operations like saving layouts
- Provide methods to add, remove, reorder, and persist widgets

```mermaid
classDiagram
class DashboardWorkspaceModel {
+widgets : Array
+layout : Object
+progress : Object
+addWidget(widgetId)
+removeWidget(widgetId)
+reorderWidgets(newOrder)
+saveLayout()
+resetProgress()
}
class WidgetPickerModel {
+availableWidgets : Array
+selectedWidgetId : string
+select(widgetId)
+clearSelection()
}
class DashboardProgressModel {
+isSaving : boolean
+errors : Array
+startSave()
+completeSave()
+setError(error)
}
DashboardWorkspaceModel --> WidgetPickerModel : "uses"
DashboardWorkspaceModel --> DashboardProgressModel : "tracks"
```

**Diagram sources**
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)
- [widget-picker-model.ts](file://apps/hr-suite/components/dashboard/widget-picker-model.ts)
- [dashboard-progress-model.ts](file://apps/hr-suite/components/dashboard/dashboard-progress-model.ts)

**Section sources**
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)
- [widget-picker-model.ts](file://apps/hr-suite/components/dashboard/widget-picker-model.ts)
- [dashboard-progress-model.ts](file://apps/hr-suite/components/dashboard/dashboard-progress-model.ts)

### HeraChatState
Responsibilities:
- Manage conversation lifecycle (create, send, receive, stream)
- Maintain message history and current input state
- Integrate with memory endpoints for context persistence
- Handle errors and retry logic for failed requests

```mermaid
sequenceDiagram
participant User as "User"
participant ChatUI as "Hera Chat UI"
participant ChatState as "HeraChatState"
participant API as "/api/hera/conversations"
participant Memory as "/api/hera/memory"
User->>ChatUI : Type message and send
ChatUI->>ChatState : sendMessage(text)
ChatState->>API : POST conversation message
API-->>ChatState : Acknowledgment
ChatState->>Memory : Save context/memory
Memory-->>ChatState : Saved
ChatState-->>ChatUI : Update message list (optimistic)
API-->>ChatState : Streamed response chunks
ChatState-->>ChatUI : Append streamed content
```

**Diagram sources**
- [hera-chat-state.ts](file://apps/hr-suite/components/hera/hera-chat-state.ts)
- [hera-chat.tsx](file://apps/hr-suite/components/hera/hera-chat.tsx)
- [route.ts](file://apps/hr-suite/app/api/hera/conversations/route.ts)
- [route.ts](file://apps/hr-suite/app/api/hera/memory/route.ts)

**Section sources**
- [hera-chat-state.ts](file://apps/hr-suite/components/hera/hera-chat-state.ts)
- [hera-chat.tsx](file://apps/hr-suite/components/hera/hera-chat.tsx)
- [route.ts](file://apps/hr-suite/app/api/hera/conversations/route.ts)
- [route.ts](file://apps/hr-suite/app/api/hera/memory/route.ts)

### Employee Data Flow
Responsibilities:
- Fetch and display employee lists with pagination and filtering
- Show detailed employee information in person cards
- Support real-time updates via subscriptions or polling

```mermaid
flowchart TD
Start(["Component Mount"]) --> FetchList["Fetch Employee List"]
FetchList --> ListLoaded{"List Loaded?"}
ListLoaded --> |No| ShowSkeleton["Show Skeleton Loader"]
ListLoaded --> |Yes| RenderList["Render Employee List"]
RenderList --> SelectEmployee["Select Employee"]
SelectEmployee --> FetchDetail["Fetch Employee Detail"]
FetchDetail --> DetailLoaded{"Detail Loaded?"}
DetailLoaded --> |No| ShowError["Show Error Message"]
DetailLoaded --> |Yes| RenderDetail["Render Employee Detail"]
RenderDetail --> SubscribeUpdates["Subscribe to Updates"]
SubscribeUpdates --> UpdateReceived{"Update Received?"}
UpdateReceived --> |Yes| MergeUpdate["Merge Update into Local State"]
MergeUpdate --> RenderUpdated["Re-render with Updated Data"]
UpdateReceived --> |No| Idle["Idle"]
```

**Diagram sources**
- [employee-list.tsx](file://apps/hr-suite/components/employees/employee-list.tsx)
- [employee-person-card.tsx](file://apps/hr-suite/components/employees/employee-person-card.tsx)
- [route.ts](file://apps/hr-suite/app/api/employees/route.ts)

**Section sources**
- [employee-list.tsx](file://apps/hr-suite/components/employees/employee-list.tsx)
- [employee-person-card.tsx](file://apps/hr-suite/components/employees/employee-person-card.tsx)
- [route.ts](file://apps/hr-suite/app/api/employees/route.ts)

### Conceptual Overview
The following diagram illustrates the general pattern used across LiquidHR for managing state:

```mermaid
graph TB
UI["UI Component"] --> Hook["Custom Hook"]
Hook --> Model["Model (State + Logic)"]
Model --> API["API Route"]
API --> DB["Supabase"]
DB --> API
API --> Model
Model --> UI
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

## Dependency Analysis
Components depend on models for stateful behavior, and models depend on API routes for data persistence. The following diagram highlights key dependencies:

```mermaid
graph TB
DWS["Dashboard Workspace"] --> DWModel["DashboardWorkspaceModel"]
HC["Hera Chat"] --> HCS["HeraChatState"]
EL["Employee List"] --> APIEmp["/api/employees"]
EPC["Employee Person Card"] --> APIEmp
DWS --> APIDash["/api/dashboards"]
HC --> APIConv["/api/hera/conversations"]
HC --> APIMem["/api/hera/memory"]
EL --> APIPref["/api/preferences/employees"]
DWS --> APISet["/api/settings/dashboard-widgets"]
```

**Diagram sources**
- [dashboard-workspace.tsx](file://apps/hr-suite/components/dashboard/dashboard-workspace.tsx)
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)
- [hera-chat.tsx](file://apps/hr-suite/components/hera/hera-chat.tsx)
- [hera-chat-state.ts](file://apps/hr-suite/components/hera/hera-chat-state.ts)
- [employee-list.tsx](file://apps/hr-suite/components/employees/employee-list.tsx)
- [employee-person-card.tsx](file://apps/hr-suite/components/employees/employee-person-card.tsx)
- [route.ts](file://apps/hr-suite/app/api/employees/route.ts)
- [route.ts](file://apps/hr-suite/app/api/dashboards/route.ts)
- [route.ts](file://apps/hr-suite/app/api/hera/conversations/route.ts)
- [route.ts](file://apps/hr-suite/app/api/hera/memory/route.ts)
- [route.ts](file://apps/hr-suite/app/api/preferences/employees/route.ts)
- [route.ts](file://apps/hr-suite/app/api/settings/dashboard-widgets/route.ts)

**Section sources**
- [dashboard-workspace.tsx](file://apps/hr-suite/components/dashboard/dashboard-workspace.tsx)
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)
- [hera-chat.tsx](file://apps/hr-suite/components/hera/hera-chat.tsx)
- [hera-chat-state.ts](file://apps/hr-suite/components/hera/hera-chat-state.ts)
- [employee-list.tsx](file://apps/hr-suite/components/employees/employee-list.tsx)
- [employee-person-card.tsx](file://apps/hr-suite/components/employees/employee-person-card.tsx)
- [route.ts](file://apps/hr-suite/app/api/employees/route.ts)
- [route.ts](file://apps/hr-suite/app/api/dashboards/route.ts)
- [route.ts](file://apps/hr-suite/app/api/hera/conversations/route.ts)
- [route.ts](file://apps/hr-suite/app/api/hera/memory/route.ts)
- [route.ts](file://apps/hr-suite/app/api/preferences/employees/route.ts)
- [route.ts](file://apps/hr-suite/app/api/settings/dashboard-widgets/route.ts)

## Performance Considerations
- Use memoization (e.g., useMemo, useCallback) in components to prevent unnecessary re-renders
- Implement pagination and virtualization for large datasets (e.g., employee lists)
- Debounce user inputs and search queries to reduce API calls
- Cache frequently accessed data locally (e.g., preferences, settings)
- Optimize real-time updates by batching and diffing changes
- Avoid deep object cloning; use immutable updates where possible

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Network errors: Implement retry logic and user-friendly error messages
- State desynchronization: Validate server responses against expected schema
- Memory leaks: Clean up subscriptions and event listeners in useEffect
- Performance bottlenecks: Profile component renders and optimize heavy computations
- Optimistic updates rollback: Ensure proper error handling to revert local changes

**Section sources**
- [hera-chat-state.ts](file://apps/hr-suite/components/hera/hera-chat-state.ts)
- [dashboard-workspace-model.ts](file://apps/hr-suite/components/dashboard/dashboard-workspace-model.ts)

## Conclusion
LiquidHR’s frontend employs a robust state management strategy centered around model-based components, React Context, and custom hooks. By clearly separating server state from client state and implementing caching, optimistic updates, and comprehensive error handling, the application delivers a responsive and reliable user experience. Following these patterns ensures scalability and maintainability as the application grows.

[No sources needed since this section summarizes without analyzing specific files]