export default function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(0, 0, 0, 0.6)",
        padding: "32px",
        borderRadius: "20px",
        width: "360px",
        boxShadow:
          "0 0 25px rgba(0, 255, 255, 0.2), inset 0 0 20px rgba(0, 255, 255, 0.08)",
        border: "1px solid rgba(0, 255, 255, 0.15)",
        backdropFilter: "blur(10px)",
        margin: "0 auto",
      }}
    >
      {children}
    </div>
  );
}
