import { Platform, Text, TextInput, type TextInputProps, type TextProps } from "react-native";
import { theme } from "../theme";

type ComponentWithDefaults<TProps> = {
  defaultProps?: Partial<TProps>;
};

let configured = false;

export function configureAppTypography() {
  if (configured) return;
  configured = true;

  const baseTextStyle = {
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.size.body,
    lineHeight: theme.typography.lineHeight.body
  };

  const textComponent = Text as unknown as ComponentWithDefaults<TextProps>;
  const inputComponent = TextInput as unknown as ComponentWithDefaults<TextInputProps>;

  if (Platform.OS === "web") return;

  textComponent.defaultProps = {
    ...textComponent.defaultProps,
    allowFontScaling: false,
    maxFontSizeMultiplier: 1,
    style: [baseTextStyle, textComponent.defaultProps?.style]
  };

  inputComponent.defaultProps = {
    ...inputComponent.defaultProps,
    allowFontScaling: false,
    maxFontSizeMultiplier: 1,
    style: [baseTextStyle, inputComponent.defaultProps?.style]
  };
}
