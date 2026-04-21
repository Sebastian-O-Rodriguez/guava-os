import { styled, YStack, View } from "tamagui";

export const Shell = styled(View, {
  name: "Shell",
  flex: 1,
  bg: "$background",
  overflow: "hidden",
});

export const Content = styled(YStack, {
  name: "Content",
  maxW: 620,
  self: "center",
  width: "100%",
  gap: "$2.5",
  p: "$2.5",
  pt: "$1.5",
  pb: "$6",

  // Tablet+
  $sm: {
    gap: "$3",
    p: "$4",
    pt: "$2",
    pb: "$8",
  },
});
