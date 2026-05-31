export function Placeholder({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="page">
      <div className="page-head">
        <h1>{title}</h1>
        <p>{blurb}</p>
      </div>
      <div className="stub">
        <div className="stub-tag">Next milestone</div>
        <p>
          This view is scaffolded but not built out yet. It plugs into the same
          <code> HermesClient </code> service, so wiring it up is additive — no changes to the
          existing screens.
        </p>
      </div>
    </div>
  );
}
