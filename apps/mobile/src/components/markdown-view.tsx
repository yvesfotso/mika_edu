import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { parseMarkdown, type Inline } from "@/lib/markdown";
import { radius, spacing, useColors } from "@/lib/theme";

function Inlines({ content }: { content: Inline[] }) {
  const c = useColors();
  return (
    <>
      {content.map((part, i) => (
        <Text
          key={i}
          style={[
            part.bold && { fontWeight: "700" },
            part.italic && { fontStyle: "italic" },
            part.code && { fontFamily: "monospace", backgroundColor: c.background },
          ]}
        >
          {part.text}
        </Text>
      ))}
    </>
  );
}

export function MarkdownView({ source }: { source: string }) {
  const c = useColors();
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  const body = { color: c.text, fontSize: 17, lineHeight: 27 };

  return (
    <View style={{ gap: spacing.md }}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return (
              <Text
                key={i}
                accessibilityRole="header"
                style={{
                  color: c.text,
                  fontWeight: "700",
                  letterSpacing: -0.3,
                  fontSize: block.level === 1 ? 26 : block.level === 2 ? 20 : 17,
                  marginTop: i === 0 ? 0 : spacing.md,
                }}
              >
                <Inlines content={block.content} />
              </Text>
            );
          case "paragraph":
            return (
              <Text key={i} style={body}>
                <Inlines content={block.content} />
              </Text>
            );
          case "quote":
            return (
              <View key={i} style={[styles.quote, { backgroundColor: c.tiles.lemon.bg }]}>
                <Text style={[body, { color: c.text }]}>
                  <Inlines content={block.content} />
                </Text>
              </View>
            );
          case "list":
            return (
              <View key={i} style={{ gap: spacing.sm }}>
                {block.items.map((item, j) => (
                  <View key={j} style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
                    {block.ordered ? (
                      <View style={[styles.number, { backgroundColor: c.strong }]}>
                        <Text style={{ color: c.primary, fontSize: 12, fontWeight: "800" }}>{j + 1}</Text>
                      </View>
                    ) : (
                      <View style={[styles.bullet, { backgroundColor: c.success }]} />
                    )}
                    <Text style={[body, { flex: 1 }]}>
                      <Inlines content={item} />
                    </Text>
                  </View>
                ))}
              </View>
            );
          case "table":
            return (
              <ScrollView key={i} horizontal showsHorizontalScrollIndicator={false}>
                <View style={[styles.table, { borderColor: c.border }]}>
                  {[block.header, ...block.rows].map((row, r) => (
                    <View key={r} style={{ flexDirection: "row", backgroundColor: r === 0 ? c.strong : r % 2 === 0 ? c.background : c.card }}>
                      {row.map((cell, k) => (
                        <View key={k} style={styles.cell}>
                          <Text style={{ color: r === 0 ? c.strongText : c.text, fontSize: 15, fontWeight: r === 0 ? "700" : "400" }}>
                            <Inlines content={cell} />
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  quote: { padding: spacing.lg, borderRadius: radius.md },
  number: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 2 },
  bullet: { width: 8, height: 8, borderRadius: 4, marginTop: 10 },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, overflow: "hidden" },
  cell: { minWidth: 110, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
});
