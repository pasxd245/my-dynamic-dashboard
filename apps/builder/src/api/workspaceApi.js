export async function createWorkspace(name) {
  const response = await fetch("/api/v1/workspaces", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error("Failed to create workspace");
  }

  return response.json();
}
