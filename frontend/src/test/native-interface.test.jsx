import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { FileText, Plus, RefreshCcw } from "lucide-react";
vi.mock("../native/platform.js", async (importOriginal) => ({
  ...(await importOriginal()),
  isNativeAndroid: () => true,
}));
vi.mock("../hooks/useAuth.jsx", () => ({
  useAuth: () => ({
    user: { email: "test@example.invalid" },
    profile: { company: "Atelier Démo", manager_name: "Eric Démo" },
    logout: vi.fn(),
    isSuperAdmin: true,
  }),
}));
import Topbar from "../components/Topbar.jsx";
import MobileTabBar from "../components/MobileTabBar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Pagination from "../components/Pagination.jsx";
import { NativeCollection } from "../native/NativeCollection.jsx";

test("Android account panel replaces the duplicate hamburger and consumes Back/Escape", () => {
  render(
    <MemoryRouter>
      <Topbar />
    </MemoryRouter>,
  );
  expect(
    screen.queryByRole("button", { name: "Ouvrir la navigation" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Menu du compte" }));
  expect(
    screen.getByRole("dialog", { name: "Mon espace" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Administration Kadi" }),
  ).toHaveAttribute("href", "/administration");
  expect(screen.getByRole("link", { name: "Mon entreprise" })).toHaveAttribute(
    "href",
    "/entreprise",
  );
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    cancelable: true,
    bubbles: true,
  });
  fireEvent(document, event);
  expect(event.defaultPrevented).toBe(true);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
test("document editors have a back destination and no section tab bar", () => {
  render(
    <MemoryRouter initialEntries={["/devis/nouveau"]}>
      <Topbar />
      <MobileTabBar />
    </MemoryRouter>,
  );
  expect(screen.getByRole("link", { name: "Retour" })).toHaveAttribute(
    "href",
    "/devis",
  );
  expect(
    screen.queryByRole("navigation", { name: "Navigation Android" }),
  ).not.toBeInTheDocument();
});
test("compact header preserves action behavior and the original accessible name", () => {
  const refresh = vi.fn(),
    create = vi.fn();
  render(
    <PageHeader
      icon={FileText}
      title="Produits & services"
      nativeTitle="Catalogue"
      nativeCreateLabel="Ajouter"
      actions={[
        <button key="refresh" onClick={refresh}>
          <RefreshCcw />
          Actualiser
        </button>,
        <button key="create" onClick={create}>
          <Plus />
          Nouvel article
        </button>,
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Actualiser" }));
  fireEvent.click(screen.getByRole("button", { name: "Nouvel article" }));
  expect(refresh).toHaveBeenCalledOnce();
  expect(create).toHaveBeenCalledOnce();
  expect(
    screen.getByRole("heading", { name: "Catalogue" }),
  ).toBeInTheDocument();
});
test("empty single page hides pagination, while multiple pages remain reachable", () => {
  const change = vi.fn();
  const view = render(
    <Pagination
      page={1}
      pageSize={10}
      total={0}
      totalPages={1}
      onPageChange={change}
    />,
  );
  expect(
    screen.queryByRole("navigation", { name: "Pagination" }),
  ).not.toBeInTheDocument();
  view.rerender(
    <Pagination
      page={1}
      pageSize={10}
      total={11}
      totalPages={2}
      onPageChange={change}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Page précédente" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Page suivante" }));
  expect(change).toHaveBeenCalledWith(2);
});
test("a failed collection never claims the account has no documents", () => {
  const retry = vi.fn();
  render(
    <NativeCollection
      label="Devis"
      count={0}
      search=""
      onSearch={vi.fn()}
      searchLabel="Recherche"
      error
      onRetry={retry}
      empty={<p>Aucun devis</p>}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Chargement impossible");
  expect(screen.queryByText("Aucun devis")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  expect(retry).toHaveBeenCalledOnce();
});
