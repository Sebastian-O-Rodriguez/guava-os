declare module "react-liquid-gauge" {
  import { Component } from "react";
  interface LiquidFillGaugeProps {
    id?: string;
    width?: number;
    height?: number;
    value?: number;
    percent?: string | React.ReactNode;
    textSize?: number;
    textOffsetX?: number;
    textOffsetY?: number;
    textRenderer?: (props: Record<string, unknown>) => React.ReactNode;
    riseAnimation?: boolean;
    riseAnimationTime?: number;
    riseAnimationEasing?: string;
    riseAnimationOnProgress?: (data: { value: number; container: unknown }) => void;
    riseAnimationOnComplete?: (data: { value: number; container: unknown }) => void;
    waveAnimation?: boolean;
    waveAnimationTime?: number;
    waveAnimationEasing?: string;
    waveAmplitude?: number;
    waveFrequency?: number;
    gradient?: boolean;
    gradientStops?: Array<{ key: string; stopColor: string; stopOpacity: number; offset: string }> | React.ReactNode;
    onClick?: (event: React.MouseEvent) => void;
    innerRadius?: number;
    outerRadius?: number;
    margin?: number;
    circleStyle?: Record<string, string>;
    waveStyle?: Record<string, string>;
    textStyle?: Record<string, string>;
    waveTextStyle?: Record<string, string>;
    style?: React.CSSProperties;
  }
  export default class LiquidFillGauge extends Component<LiquidFillGaugeProps> {}
}
