// デフォルトのデザイン情報オブジェクト
const defaultDesignInfo = {
    fonts: ["Noto Sans JP", "sans-serif"],
    layout: {
      pageCount: 1,
      margins: {
        top: "30px",
        right: "30px",
        bottom: "30px",
        left: "30px"
      }
    },
    styles: {
      heading1: {
        fontSize: "20px",
        fontFamily: "'Noto Sans JP', sans-serif",
        fontWeight: "700",
        color: "#000000",
        lineHeight: "1.4",
        textAlign: "left"
      },
      heading2: {
        fontSize: "17px",
        fontFamily: "'Noto Sans JP', sans-serif",
        fontWeight: "700",
        color: "#000000",
        lineHeight: "1.4",
        textAlign: "left"
      },
      heading3: {
        fontSize: "15px",
        fontFamily: "'Noto Sans JP', sans-serif",
        fontWeight: "600",
        color: "#000000",
        lineHeight: "1.4",
        textAlign: "left"
      },
      paragraph: {
        fontSize: "14px",
        fontFamily: "'Noto Sans JP', sans-serif",
        fontWeight: "400",
        color: "#000000",
        lineHeight: "1.6",
        textAlign: "left"
      },
      listItem: {
        fontSize: "14px",
        fontFamily: "'Noto Sans JP', sans-serif",
        fontWeight: "400",
        color: "#000000",
        lineHeight: "1.6",
        textAlign: "left"
      },
      blockquote: {
        fontSize: "14px",
        fontFamily: "'Noto Sans JP', sans-serif",
        fontWeight: "400",
        color: "#333333",
        lineHeight: "1.6",
        textAlign: "left"
      }
    },
    cssRules: [
      {
        selector: "h1, .heading1",
        properties: {
          "font-size": "22px",
          "font-family": "'Noto Sans JP', sans-serif",
          "font-weight": "700",
          "color": "#000000",
          "margin-top": "20px",
          "margin-bottom": "15px",
          "padding-bottom": "5px"
        }
      },
      {
        selector: "h2, .heading2",
        properties: {
          "font-size": "18px",
          "font-family": "'Noto Sans JP', sans-serif",
          "font-weight": "700",
          "color": "#000000",
          "margin-top": "15px",
          "margin-bottom": "10px"
        }
      },
      {
        selector: "h3, .heading3",
        properties: {
          "font-size": "16px",
          "font-family": "'Noto Sans JP', sans-serif",
          "font-weight": "600",
          "color": "#000000",
          "margin-top": "12px",
          "margin-bottom": "8px"
        }
      },
      {
        selector: "p, .paragraph",
        properties: {
          "font-size": "14px",
          "font-family": "'Noto Sans JP', sans-serif",
          "font-weight": "400",
          "color": "#000000",
          "line-height": "1.6",
          "margin-top": "8px",
          "margin-bottom": "8px"
        }
      },
      {
        selector: "ul, ol",
        properties: {
          "margin-top": "8px",
          "margin-bottom": "8px",
          "padding-left": "20px"
        }
      },
      {
        selector: "li, .listItem",
        properties: {
          "font-size": "14px",
          "font-family": "'Noto Sans JP', sans-serif",
          "font-weight": "400",
          "color": "#000000",
          "line-height": "1.6",
          "margin-top": "4px",
          "margin-bottom": "4px"
        }
      },
      {
        selector: "blockquote, .blockquote",
        properties: {
          "font-size": "14px",
          "font-family": "'Noto Sans JP', sans-serif",
          "font-weight": "400",
          "color": "#333333",
          "line-height": "1.6",
          "margin-top": "10px",
          "margin-bottom": "10px",
          "padding-left": "15px",
          "border-left": "3px solid #dddddd",
          "font-style": "italic"
        }
      },
      {
        selector: ".section",
        properties: {
          "margin-top": "20px",
          "margin-bottom": "20px"
        }
      },
      {
        selector: ".skills-section",
        properties: {
          "margin-top": "15px",
          "display": "flex",
          "flex-wrap": "wrap",
          "gap": "8px"
        }
      },
      {
        selector: ".skill-tag",
        properties: {
          "display": "inline-block",
          "padding": "4px 8px",
          "border-radius": "4px",
          "background-color": "#f5f5f5",
          "font-size": "12px",
          "font-weight": "400"
        }
      },
      {
        selector: ".company-period",
        properties: {
          "font-size": "13px",
          "color": "#555555",
          "font-weight": "400",
          "margin-bottom": "5px"
        }
      },
      {
        selector: ".project-name",
        properties: {
          "font-weight": "600",
          "margin-top": "10px",
          "margin-bottom": "5px"
        }
      }
    ]
  };
  
  export default defaultDesignInfo;