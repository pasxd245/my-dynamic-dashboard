import { Button } from "antd";

export function App() {
  return (
    <main style={{ padding: "2rem", maxWidth: "640px", margin: "0 auto" }}>
      <h1>my-dynamic-dashboard — Builder</h1>
      <p>
        Round 03 skeleton: this page is wrapped in{" "}
        <code>&lt;AntdConfig&gt;</code> from <code>@mdd/ui</code>. The button
        below should pick up the theme tokens defined in the UI package.
      </p>
      <Button type="primary">Theme proof</Button>
    </main>
  );
}
