export default function ModalShell({ title, children }) {
  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-panel">
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
