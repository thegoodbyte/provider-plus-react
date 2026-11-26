import type { ThemeConfig } from "antd";
import tokens from "./tokens.json";
/** Also themes portals rendered under body: no dependency on workspace DOM ancestry. */
export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: tokens.colors.primary,
    colorInfo: tokens.colors.info,
    colorSuccess: tokens.colors.success,
    colorWarning: tokens.colors.warning,
    colorError: tokens.colors.critical,
    colorText: tokens.colors.ink,
    colorTextSecondary: tokens.colors.muted,
    colorBorder: tokens.colors.line,
    colorBgContainer: tokens.colors.surface,
    colorBgLayout: tokens.colors.canvas,
    borderRadius: parseInt(tokens.radius.control),
    controlHeight: tokens.controlHeight,
    fontSize: parseInt(tokens.fontSize.widget),
    fontFamily: tokens.typography.sans.join(", "),
  },
  components: {
    Button: {
      primaryShadow: "none",
      dangerShadow: "none",
      defaultShadow: "none",
    },
    Table: { headerBg: tokens.colors.subtle, rowHoverBg: tokens.colors.canvas },
    Modal: { borderRadiusLG: parseInt(tokens.radius.dialog) },
    Card: { borderRadiusLG: parseInt(tokens.radius.card) },
  },
};
