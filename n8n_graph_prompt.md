# Instructions for Building InGen Studio Graph & Chat Editors (Version 2/3)

This prompt file provides a step-by-step blueprint for building the visual graph editor (N8N-style) and the chat interface (ChatGPT-style) for InGen Studio. Follow these instructions carefully to implement the views, wire them into the shared `ConfigContext` state, and ensure full feature parity.

---

## Part 1: Routing & Tab Switcher in `InterfaceEditor.jsx`

1. Open [InterfaceEditor.jsx](file:///c:/VOLUME_D/Interns/BlackRock/ingen/frontend/src/components/editor/InterfaceEditor.jsx).
2. Add a `viewMode` state using `useState('manual')` (defaulting to the current forms-based view).
3. Inside the layout, right under the header section (`<header className="editor__head">...`), insert a segmented tab switcher:
   ```jsx
   <div className="view-selector">
     <button 
       className={`view-selector__btn ${viewMode === 'manual' ? 'view-selector__btn--active' : ''}`}
       onClick={() => setViewMode('manual')}
     >
       Manual Forms
     </button>
     <button 
       className={`view-selector__btn ${viewMode === 'graph' ? 'view-selector__btn--active' : ''}`}
       onClick={() => setViewMode('graph')}
     >
       Graph Workflow
     </button>
     <button 
       className={`view-selector__btn ${viewMode === 'chat' ? 'view-selector__btn--active' : ''}`}
       onClick={() => setViewMode('chat')}
     >
       Chat Assistant
     </button>
   </div>
   ```
4. Render the appropriate view:
   - For `'manual'`: Render the existing tab bar (`<div className="tabbar">...`) and active tab panel.
   - For `'graph'`: Render `<InterfaceGraphEditor interfaceName={interfaceName} iface={iface} />`.
   - For `'chat'`: Render `<InterfaceChatEditor interfaceName={interfaceName} iface={iface} />`.
5. Add matching CSS rules for `.view-selector` in `InterfaceEditor.css` or `index.css`:
   - It should be a flex row, border-radius, background of raised ink/slate, with padding.
   - Segmented buttons should have smooth background hover transitions, with the active button highlighted in the brand's teal accent.

---

## Part 2: Building the React Flow Graph Editor (`InterfaceGraphEditor.jsx`)

Create a new file `src/components/editor/graph/InterfaceGraphEditor.jsx` that integrates React Flow.

### 1. Nodes & Edges Generation
Generate nodes and edges dynamically based on `iface` (the active interface config) and `model` (the parent metadata config, for lookup of source specifications).

- **Source Nodes (`src-[id]`)**: Create a node for each source listed in `iface.sources`.
- **Pre-processing Nodes (`pre-[idx]`)**: Create a node for each pre-processing step inside `iface.pre_processing`. Show step type (e.g. `merge`, `melt`, `filter`) and index label.
- **Columns Node (`columns`)**: Create a single node for columns mapping.
- **Post-processing Node (`post`)**: Create a node if `iface.post_processing` is defined.
- **Validation Node (`validations`)**: Create a validations summary node.
- **Output Node (`output`)**: Create a node showing the output type and file path.

**Layout Algorithm:**
Arrange these nodes in columns from left to right:
1. Column 1 ($X = 100$): Source nodes stacked vertically ($Y = 100, 250, \dots$).
2. Column 2 ($X = 350$): Pre-processing nodes stacked vertically ($Y = 100, 250, \dots$).
3. Column 3 ($X = 600$): Columns node ($Y = 150$).
4. Column 4 ($X = 850$): Post-processing node ($Y = 150$) if present.
5. Column 5 ($X = 1100$): Validations node ($Y = 150$).
6. Column 6 ($X = 1350$): Output node ($Y = 150$).

**Edges Connection rules:**
- Connect all Source nodes to the first Pre-processing step. If no pre-processing steps exist, connect them to the Columns node.
- Connect Pre-processing steps sequentially: $Step_1 \rightarrow Step_2 \rightarrow \dots \rightarrow Step_N$.
- Connect the final Pre-processing step to the Columns node.
- Connect Columns node $\rightarrow$ Post-processing (if configured) $\rightarrow$ Validations $\rightarrow$ Output.

### 2. Properties Panel Sidebar
When a node is clicked:
1. Set a state `selectedNode` to the clicked node.
2. Render a slide-out `<div className="properties-drawer">` on the right side of the canvas.
3. Depending on the `selectedNode.type` or custom attributes, load the corresponding forms:
   - **Source Node:** Render `SourcesTab` inside the drawer or a simplified list editor.
   - **Pre-processing Node:** Render `SchemaForm` with `schema={preProcessorSchema(step.type)}` and wire changes to `updateInterface`. Include a delete button.
   - **Columns Node:** Render the mapping fields and formatter editor tables (reusing components or styling from `ColumnsTab.jsx`).
   - **Post-processing Node:** Render the pivot form from `PostProcessingTab.jsx`.
   - **Validation Node:** Render the expectations list from `ValidationsTab.jsx`.
   - **Output Node:** Render the writer options from `OutputTab.jsx`.

All edits inside these forms must trigger `updateInterface(interfaceName, (iface) => ...)` to immediately save changes into `ConfigContext`.

---

## Part 3: Building the Chat Assistant (`InterfaceChatEditor.jsx`)

Create a new file `src/components/editor/chat/InterfaceChatEditor.jsx` that provides a premium ChatGPT-like interface inside the workspace.

### 1. UI Elements
- **Message list panel:** Render bubbles for `user` and `assistant`. Use slate colors for user messages and darker panels for assistant messages, aligned with the InGen theme.
- **Scroll to bottom effect:** Auto-scroll the container whenever a new message is appended.
- **Predefined suggestion chips:** Render clickable buttons at the top of the input area:
  - `"Add merge step with restrictions"`
  - `"Filter records where status is CLOSED"`
  - `"Change output to Excel report"`
- **Message form:** A chat-style text input box and a teal send button.

### 2. Interactive Mock AI Handler
To make the chat interface interactive and functional in Version 2 before connecting the local LLM in Version 3, implement a pattern-matching execution engine:

- When a message is sent, show a typing indicator (`"Assistant is thinking..."`) for 1-2 seconds.
- Match user inputs against the following regex patterns to perform actual changes on `ConfigContext`:
  - **Add source command:** Match `add source (\w+) (\w+)` (e.g. `add source trade_db mysql`).
    - Action: Call `updateModel` to create a source definition, then add the source ID to the interface's sources array.
    - Response: `"I have added the source '${name}' of type '${type}' to your workspace. You can now see it in the graph and the YAML panel!"`
  - **Add filter step command:** Match `filter (\w+) (\w+)` (e.g., `filter status CLOSED`).
    - Action: Append a pre-processing step of type `filter` or `not_equals_filter` with the column and value details configured.
    - Response: `"I added a filter step to drop rows where '${col}' is not equal to '${val}'."`
  - **Set output path command:** Match `change output to (.+)` (e.g. `change output to c:/data/positions.xlsx`).
    - Action: Check extension and update `iface.output` properties (e.g., type `excel` and path value).
    - Response: `"I updated your output destination. It is now set to output as excel to '${path}'."`
  - **Default Response:** If no pattern is matched, respond with:
    - `"I understand you want to modify your pipeline. In Version 3, this chat will be connected to your local LLM, allowing complex natural language edits. For now, try typing: 'add source trade_db mysql' or 'change output to c:/data/out.xlsx'."`

---

## Part 4: CSS Styles & Theme Integrations

Create `InterfaceGraphEditor.css` and `InterfaceChatEditor.css`. Ensure styling details match the main InGen Studio design tokens:
- Background color for canvas grid: `#12161d` (ink) or warm neutral paper `#f3f4f1`.
- Node header borders matching custom categories (Blue for Sources, Orange for transforms, Purple for outputs).
- Monospace font styling for table schemas, code segments, and chip badges.
- Glassmorphism/shadow cards for the slide-out Properties drawer.
