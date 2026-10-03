export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

/** Text styles matching the Figma hierarchy (412 px wide frame). */
export const typography = {
  display: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 38 },
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34 },
  heading: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  captionStrong: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  pill: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 0.6 },
  button: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  tab: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
};
