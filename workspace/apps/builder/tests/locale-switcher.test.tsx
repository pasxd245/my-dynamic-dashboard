import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocaleSwitcher } from "@/i18n/LocaleSwitcher";
import { i18n, LOCALE_STORAGE_KEY } from "@/i18n";

describe("LocaleSwitcher", () => {
  beforeEach(async () => {
    globalThis.localStorage?.removeItem(LOCALE_STORAGE_KEY);
    await act(async () => {
      await i18n.changeLanguage("en");
    });
  });

  afterEach(async () => {
    globalThis.localStorage?.removeItem(LOCALE_STORAGE_KEY);
    await act(async () => {
      await i18n.changeLanguage("en");
    });
  });

  it("renders the current language as a compact pill", () => {
    render(<LocaleSwitcher />);
    const trigger = screen.getByRole("button", { name: /Current language/ });
    expect(trigger).toHaveAttribute("data-current", "en");
    expect(trigger).toHaveTextContent("EN");
  });

  it("flips the active language and persists to localStorage when a menu item is clicked", async () => {
    render(<LocaleSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: /Current language/ }));

    // Menu items render in a portal; query by visible label text.
    const viOption = await screen.findByText("Tiếng Việt");
    await act(async () => {
      fireEvent.click(viOption);
    });

    await waitFor(() => {
      expect(i18n.language).toBe("vi");
    });
    expect(globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY)).toBe("vi");
  });

  it("is a no-op when the current language is re-selected", async () => {
    render(<LocaleSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: /Current language/ }));
    const enOption = await screen.findByText("English");
    await act(async () => {
      fireEvent.click(enOption);
    });

    expect(i18n.language).toBe("en");
    // No write to storage when the locale didn't actually change.
    expect(globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY)).toBeNull();
  });
});
