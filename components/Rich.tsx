/**
 * טקסט עשיר, לפי תקן הזיקוק של ענת.
 *
 * `**מילה**` מודגשת, `==תובנה==` מסומנת במרקר, וכל מספר מודגש מעצמו
 * בכיוון LTR מבודד. ההדגשות נכתבות פעם אחת בקובץ התוכן, לא בכל רכיב.
 */
const TOKEN = /(\*\*[^*]+\*\*|==[^=]+==)/g;
const NUM = /(\d[\d,]*(?:\.\d+)?%?)/g;

function Numbers({ text }: { text: string }) {
  return (
    <>
      {text.split(NUM).map((part, i) =>
        i % 2 ? (
          <bdi key={i} className="num">
            {part}
          </bdi>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default function Rich({
  children,
  as: Tag = "span",
  className,
}: {
  children: string;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "div";
  className?: string;
}) {
  const parts = String(children).split(TOKEN);
  return (
    <Tag className={className}>
      {parts.map((part, i) => {
        if (part.startsWith("**")) {
          return (
            <strong key={i}>
              <Numbers text={part.slice(2, -2)} />
            </strong>
          );
        }
        if (part.startsWith("==")) {
          return (
            <mark key={i} className="insight">
              <Numbers text={part.slice(2, -2)} />
            </mark>
          );
        }
        return <Numbers key={i} text={part} />;
      })}
    </Tag>
  );
}
