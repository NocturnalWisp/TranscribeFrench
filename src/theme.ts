import { extendTheme, type ThemeConfig } from "@chakra-ui/react";

const config: ThemeConfig = {
  initialColorMode: "light",
  useSystemColorMode: false
};

export const theme = extendTheme({
  config,
  fonts: {
    heading: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    body: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  styles: {
    global: {
      "html, body, #root": {
        height: "100%",
        minHeight: "100dvh"
      },
      body: {
        bg: "gray.50",
        color: "gray.800",
        WebkitTapHighlightColor: "transparent"
      }
    }
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: "semibold"
      },
      sizes: {
        touch: {
          h: "48px",
          minW: "48px",
          fontSize: "md",
          px: 4
        }
      }
    }
  }
});
