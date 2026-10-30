import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { useInvoiceDraft } from "./useInvoiceDraft";
import { invoiceDraftsApi } from "../services/api";
jest.mock("../services/api", () => ({
  invoiceDraftsApi: {
    list: jest.fn(),
    get: jest.fn(),
    save: jest.fn(),
    issue: jest.fn(),
    discard: jest.fn(),
  },
}));
const api = invoiceDraftsApi as jest.Mocked<typeof invoiceDraftsApi>;
const empty = () => ({
  title: "Service payment request",
  clientId: "",
  currency: "EUR",
  items: [],
});
const eight = () => ({
  ...empty(),
  title: "Eight items",
  items: Array.from({ length: 8 }, (_, i) => ({
    type: "charge",
    description: "Item " + (i + 1),
    quantity: 1,
    unitPrice: 10 + i,
  })),
});
const draftId = "11111111-1111-4111-8111-111111111111";
const mount = (onIssued = jest.fn()) =>
  renderHook(() => {
    const [payload, setPayload] = useState<any>(empty());
    const draft = useInvoiceDraft({
      enabled: true,
      payload,
      apply: setPayload,
      empty,
      initialClient: null,
      onIssued,
    });
    return { ...draft, payload, setPayload };
  });
beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  localStorage.setItem("user", JSON.stringify({ id: "staff-a" }));
  api.list.mockResolvedValue({ data: [] } as any);
  api.get.mockRejectedValue({ response: { status: 404 } });
  api.save.mockImplementation(
    async (id, b) =>
      ({
        data: {
          draftId: id,
          revision: b.revision + 1,
          payload: b.payload,
          updatedAt: "2026-10-30T12:00:00Z",
        },
      }) as any,
  );
  api.issue.mockResolvedValue({ data: { _id: "issued-request" } } as any);
  api.discard.mockResolvedValue({ data: { discarded: true } } as any);
});
it("restores all eight rows without autosaving an empty form over the saved draft", async () => {
  api.list.mockResolvedValue({
    data: [{ draftId, revision: 2, payload: eight(), status: "draft" }],
  } as any);
  const h = mount();
  await waitFor(() => expect(h.result.current.ready).toBe(true));
  expect(h.result.current.payload.items).toHaveLength(8);
  expect(api.save).not.toHaveBeenCalled();
  act(() =>
    h.result.current.setPayload((p: any) => ({ ...p, title: "Edited title" })),
  );
  await act(async () => {
    await h.result.current.flush();
  });
  expect(api.save).toHaveBeenCalledWith(
    draftId,
    expect.objectContaining({
      revision: 2,
      payload: expect.objectContaining({ title: "Edited title" }),
    }),
  );
  expect(api.issue).not.toHaveBeenCalled();
  h.unmount();
});
it("keeps an eight-item browser recovery copy after network failure and restores it after navigation/remount", async () => {
  const h = mount();
  await waitFor(() => expect(h.result.current.ready).toBe(true));
  act(() => h.result.current.setPayload(eight()));
  api.save.mockRejectedValueOnce(new Error("offline"));
  await act(async () => {
    await expect(h.result.current.flush()).rejects.toThrow("offline");
  });
  expect(h.result.current.payload.items).toHaveLength(8);
  expect(h.result.current.error).toMatch(/browser recovery/);
  const id = h.result.current.draftId;
  expect(
    JSON.parse(localStorage.getItem("ppvc.invoice-draft.v1:staff-a:" + id)!)
      .payload.items,
  ).toHaveLength(8);
  h.unmount();
  const recovered = mount();
  await waitFor(() => expect(recovered.result.current.ready).toBe(true));
  expect(recovered.result.current.payload.items).toHaveLength(8);
  expect(recovered.result.current.restored).toBe(true);
  await act(async () => {
    await recovered.result.current.flush();
  });
  expect(
    localStorage.getItem("ppvc.invoice-draft.v1:staff-a:" + id),
  ).toBeNull();
  recovered.unmount();
});
it("does not load a different account recovery copy", async () => {
  localStorage.setItem(
    "ppvc.invoice-draft.v1:staff-b:" + draftId,
    JSON.stringify({
      draftId,
      revision: 0,
      payload: eight(),
      updatedAt: Date.now(),
    }),
  );
  const h = mount();
  await waitFor(() => expect(h.result.current.ready).toBe(true));
  expect(h.result.current.payload.items).toHaveLength(0);
  expect(api.issue).not.toHaveBeenCalled();
  h.unmount();
});
it("preserves edits on revision conflict and saves a separate copy instead of overwriting another tab", async () => {
  api.list.mockResolvedValue({
    data: [{ draftId, revision: 2, payload: eight(), status: "draft" }],
  } as any);
  const h = mount();
  await waitFor(() => expect(h.result.current.ready).toBe(true));
  act(() =>
    h.result.current.setPayload((p: any) => ({
      ...p,
      title: "My unsaved edits",
    })),
  );
  api.save.mockRejectedValueOnce({ response: { status: 409 } });
  await act(async () => {
    await expect(h.result.current.flush()).rejects.toBeTruthy();
  });
  expect(h.result.current.error).toMatch(/another tab/);
  expect(h.result.current.payload.items).toHaveLength(8);
  act(() => h.result.current.copy());
  expect(h.result.current.draftId).not.toBe(draftId);
  await act(async () => {
    await h.result.current.flush();
  });
  expect(api.save).toHaveBeenLastCalledWith(
    h.result.current.draftId,
    expect.objectContaining({ revision: 0 }),
  );
  expect(
    localStorage.getItem("ppvc.invoice-draft.v1:staff-a:" + draftId),
  ).toBeNull();
  h.unmount();
});
it("recovers a successful issued request after an ambiguous network failure, without issuing again", async () => {
  const h = mount();
  await waitFor(() => expect(h.result.current.ready).toBe(true));
  act(() => h.result.current.setPayload(eight()));
  api.issue.mockRejectedValueOnce(new Error("response lost"));
  await act(async () => {
    await expect(h.result.current.issue()).rejects.toThrow("response lost");
  });
  const id = h.result.current.draftId;
  h.unmount();
  api.get.mockResolvedValue({
    data: {
      draftId: id,
      status: "issued",
      paymentRequestId: "original-request",
    },
  } as any);
  const onIssued = jest.fn();
  const recovered = mount(onIssued);
  await waitFor(() =>
    expect(onIssued).toHaveBeenCalledWith("original-request"),
  );
  expect(api.issue).toHaveBeenCalledTimes(1);
  expect(
    localStorage.getItem("ppvc.invoice-draft.v1:staff-a:" + id),
  ).toBeNull();
  recovered.unmount();
});
it("ignores corrupt recovery entries while retaining another valid eight-item backup", async () => {
  localStorage.setItem("ppvc.invoice-draft.v1:staff-a:broken", "bad-json");
  localStorage.setItem(
    "ppvc.invoice-draft.v1:staff-a:" + draftId,
    JSON.stringify({
      draftId,
      revision: 0,
      payload: eight(),
      updatedAt: Date.now(),
    }),
  );
  const h = mount();
  await waitFor(() => expect(h.result.current.ready).toBe(true));
  expect(h.result.current.payload.items).toHaveLength(8);
  h.unmount();
});
it("keeps an unfinished issuance locked against autosave and retries its original request safely", async () => {
  api.list.mockResolvedValue({
    data: [{ draftId, revision: 3, status: "issuing", payload: eight() }],
  } as any);
  const h = mount();
  await waitFor(() => expect(h.result.current.ready).toBe(true));
  expect(h.result.current.issuing).toBe(true);
  await act(async () => {
    await h.result.current.flush();
  });
  expect(api.save).not.toHaveBeenCalled();
  await act(async () => {
    const r = await h.result.current.issue();
    expect(r.data._id).toBe("issued-request");
  });
  expect(api.issue).toHaveBeenCalledWith(draftId, { revision: 3 });
  h.unmount();
});
it("can use a server-saved draft when browser recovery storage is unavailable", async () => {
  const h = mount();
  await waitFor(() => expect(h.result.current.ready).toBe(true));
  const spy = jest
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("quota");
    });
  try {
    act(() => h.result.current.setPayload(eight()));
    await act(async () => {
      await h.result.current.flush();
    });
    expect(api.save).toHaveBeenCalled();
    await act(async () => {
      const r = await h.result.current.issue();
      expect(r.data._id).toBe("issued-request");
    });
    expect(api.issue).toHaveBeenCalledTimes(1);
  } finally {
    spy.mockRestore();
    h.unmount();
  }
});
