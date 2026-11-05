import { createContext, useContext } from "react";
export const FinanceAccessContext = createContext<(cap: string) => boolean>(
  () => true,
);
export const useFinancePermission = () => useContext(FinanceAccessContext);
