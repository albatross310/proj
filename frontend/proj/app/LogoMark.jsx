// Backgroundless DotComma logo mark, intended to sit to the left of a page
// heading. Transparent (no tile); the white dot stays solid so it reads on
// both light and dark page backgrounds.
export default function LogoMark({ size = 40, style }) {
  return (
    <img
      src="/logo-mark.svg"
      alt=""
      aria-hidden="true"
      height={size}
      style={{
        verticalAlign: "middle",
        marginRight: 12,
        marginTop: -4,
        ...style
      }}
    />
  );
}
