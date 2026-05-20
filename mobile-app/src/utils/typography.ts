import React from "react";
import { Text, TextInput, type TextInputProps, type TextProps } from "react-native";
import { theme } from "../theme";

type ComponentWithDefaults<TProps> = {
  defaultProps?: Partial<TProps>;
  render?: (props: TProps, ref?: unknown) => React.ReactElement | null;
  __kabisigTypographyPatched?: boolean;
};

let configured = false;

function patchRenderedStyle<TProps extends TextProps | TextInputProps>(component: ComponentWithDefaults<TProps>, baseStyle: TProps["style"]) {
  if (component.__kabisigTypographyPatched || typeof component.render !== "function") return;

  const originalRender = component.render;
  component.render = function patchedTypographyRender(props: TProps, ref?: unknown) {
    const element = originalRender(props, ref);
    if (!React.isValidElement<TProps>(element)) return element;

    return React.cloneElement(element, {
      allowFontScaling: false,
      maxFontSizeMultiplier: 1,
      style: [baseStyle, element.props.style]
    } as Partial<TProps>);
  };
  component.__kabisigTypographyPatched = true;
}

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

  patchRenderedStyle(textComponent, baseTextStyle);
  patchRenderedStyle(inputComponent, baseTextStyle);
}
