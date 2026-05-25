import { render, screen, act } from "@testing-library/react";
import { afterAll, describe, expect, it } from "vitest";
import { useTranslation } from "react-i18next";
import { i18n } from "@/i18n";

function ProbeButton() {
  const { t } = useTranslation();
  return <button>{t("common.create")}</button>;
}

function ProbeMissingKey() {
  const { t } = useTranslation();
  return <span>{t("nope.does_not_exist", "fallback-default")}</span>;
}

describe("i18n", () => {
  // Each test sets its own language; reset to English after the suite
  // so other test files keep their default expectation.
  afterAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders the English string when language is 'en'", async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    render(<ProbeButton />);
    expect(screen.getByRole("button")).toHaveTextContent("Create");
  });

  it("renders the Vietnamese string when language is 'vi'", async () => {
    await act(async () => {
      await i18n.changeLanguage("vi");
    });
    render(<ProbeButton />);
    expect(screen.getByRole("button")).toHaveTextContent("Tạo");
  });

  it("falls back to the default for missing keys (not the raw key)", async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    render(<ProbeMissingKey />);
    expect(screen.getByText("fallback-default")).toBeInTheDocument();
  });
});
