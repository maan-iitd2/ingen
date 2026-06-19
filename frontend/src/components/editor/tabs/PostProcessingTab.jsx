//  Post-processing tab — frame-level transforms applied after formatting (currently only `pivot`).
//  Form surface, not a graph. Phase 1 renders configured steps; the pivot form is Phase 2.

export default function PostProcessingTab({ iface }) {
  const steps = iface.post_processing ?? [];

  return (
    <div className="tabcontent">
      <p className="tabcontent__hint">Applied after column formatting, before final validation.</p>
      {steps.length === 0 ? (
        <div className="emptyblock">No post-processing configured.</div>
      ) : (
        <ul className="kvlist">
          {steps.map((step, i) => (
            <li key={i} className="kvlist__row">
              <span className="chip chip--accent">{step.type}</span>
              <pre className="mono kvlist__json">{JSON.stringify(step.processing_values ?? {}, null, 2)}</pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
