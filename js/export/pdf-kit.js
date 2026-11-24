export const PAGE = { w: 210, h: 297, m: 10, cw: 190 }

const HEAD_H = 7.5
const ROW_H = 6.5

export const imgH = img => PAGE.cw * (img.h / img.w)

export const tableH = (rows, foot) => HEAD_H + ROW_H * (rows.length + (foot ? 1 : 0)) + 6

export const sanitize = text =>
  String(text)
    .replace(/Δ/g, 'delta').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/α/g, 'alpha')
    .replace(/ν/g, 'nu').replace(/σ/g, 'sigma').replace(/ε/g, 'eps').replace(/²/g, '2')

export const ensure = (pdf, st, need) => {
  if (st.y + need > PAGE.h - PAGE.m) {
    pdf.addPage()
    st.y = PAGE.m
  }
}

export const section = (pdf, st, title, contentNeed = 0) => {
  ensure(pdf, st, 9 + contentNeed)
  pdf.setFillColor(17, 17, 17)
  pdf.rect(PAGE.m, st.y, 2.5, 6, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(17, 17, 17)
  pdf.text(title, PAGE.m + 5, st.y + 4.8)
  st.y += 9
}

export const subTitle = (pdf, st, text) => {
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(60, 60, 60)
  pdf.text(text, PAGE.m, st.y + 3)
  st.y += 5
}

export const addImage = (pdf, st, img, caption) => {
  if (!img) return
  const h = imgH(img)
  ensure(pdf, st, h + (caption ? 9 : 5))
  if (caption) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(70, 70, 70)
    pdf.text(caption, PAGE.m, st.y + 3)
    st.y += 5
  }
  pdf.addImage(img.url, 'PNG', PAGE.m, st.y, PAGE.cw, h)
  st.y += h + 6
}

const drawRow = (pdf, y, colW, cells, bold, fill) => {
  if (fill) {
    pdf.setFillColor(fill[0], fill[1], fill[2])
    pdf.rect(PAGE.m, y, PAGE.cw, ROW_H, 'F')
  }
  pdf.setFont('helvetica', bold ? 'bold' : 'normal')
  pdf.setFontSize(6.8)
  pdf.setTextColor(17, 17, 17)
  let x = PAGE.m
  cells.forEach((cell, i) => {
    pdf.text(String(cell), x + 1, y + 4.4)
    x += colW[i]
  })
}

const drawGrid = (pdf, y0, y1, colW, rowCount) => {
  pdf.setDrawColor(150, 150, 150)
  pdf.setLineWidth(0.2)
  pdf.rect(PAGE.m, y0, PAGE.cw, y1 - y0)
  for (let i = 0; i <= rowCount; i++) {
    const y = y0 + HEAD_H + ROW_H * i
    pdf.line(PAGE.m, y, PAGE.m + PAGE.cw, y)
  }
  let x = PAGE.m
  colW.slice(0, -1).forEach(w => {
    x += w
    pdf.line(x, y0, x, y1)
  })
}

export const addTable = (pdf, st, headers, rows, ratios, foot) => {
  const colW = ratios.map(r => r * PAGE.cw)
  ensure(pdf, st, tableH(rows, foot))
  const y0 = st.y
  pdf.setFillColor(238, 238, 238)
  pdf.rect(PAGE.m, y0, PAGE.cw, HEAD_H, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(6.8)
  pdf.setTextColor(17, 17, 17)
  let x = PAGE.m
  headers.forEach((h, i) => {
    pdf.text(h, x + 1, y0 + 4.9)
    x += colW[i]
  })
  let y = y0 + HEAD_H
  rows.forEach(cells => {
    drawRow(pdf, y, colW, cells, false, null)
    y += ROW_H
  })
  if (foot) {
    drawRow(pdf, y, colW, foot, true, [221, 221, 221])
    y += ROW_H
  }
  drawGrid(pdf, y0, y, colW, rows.length)
  st.y = y + 6
}
