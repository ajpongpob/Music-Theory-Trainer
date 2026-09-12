(() => {
'use strict';
const app=window.MajorScaleApp=window.MajorScaleApp || {};
const NS="http://www.w3.org/2000/svg";

function createSvgElement(name,attrs={},text=""){
  const node=document.createElementNS(NS,name);
  Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,value));
  if(text) node.textContent=text;
  return node;
}

function accidentalSmuflGlyph(value,smufl){
  return {
    "b":smufl.accidentalFlat,
    "":smufl.accidentalNatural,
    "#":smufl.accidentalSharp,
    "##":smufl.accidentalDoubleSharp,
    "bb":smufl.accidentalDoubleFlat
  }[value] ?? "";
}

function drawLedger(svg,x,step,stepToY){
  const ys=[];if(step<0){for(let s=-2;s>=step;s-=2)ys.push(stepToY(s))}
  else if(step>8){for(let s=10;s<=step;s+=2)ys.push(stepToY(s))}
  ys.forEach(y=>svg.appendChild(createSvgElement("line",{x1:x-18,y1:y,x2:x+18,y2:y,stroke:"#111","stroke-width":1.4})));
}

function drawKeySignature(svg,key,signatureMode,staff,options){
  if(signatureMode!=="shown"||key.acc===0)return;

  const symbols=key.type==="sharp"?options.sharpOrder.slice(0,key.acc):options.flatOrder.slice(0,key.acc);
  const sharpSteps={F:8,C:5,G:9,D:6,A:3,E:7,B:4};
  const flatSteps={B:4,E:7,A:3,D:6,G:2,C:5,F:1};
  const glyph=key.type==="sharp"?options.sharpGlyph:options.flatGlyph;

  symbols.forEach((letter,i)=>{
    const step=key.type==="sharp"?sharpSteps[letter]:flatSteps[letter];
    const y=staff.top+staff.spacing*4-step*(staff.spacing/2);

    svg.appendChild(createSvgElement("text",{
      x:staff.sigX+i*options.advance,
      y,
      "font-size":options.fontSize,
      "font-family":options.fontFamily,
      fill:"#111",
      class:"key-signature-glyph",
      "pointer-events":"none"
    },glyph));
  });
}

function rightEdgeOfSvgClass(svg,className){
  let right=-Infinity;
  svg.querySelectorAll("."+className).forEach(node=>{
    try{
      const box=node.getBBox();
      right=Math.max(right,box.x+box.width);
    }catch(err){}
  });
  return Number.isFinite(right)?right:null;
}

function drawTimeSignature(svg,staff,x,options){
  const box=options.measureText(svg,options.glyph,options.fontSize,options.fontFamily);

  // Visible left edge starts exactly at x.
  const textX=x-box.x;
  const centers=[
    staff.top+staff.spacing,
    staff.top+staff.spacing*3
  ];

  centers.forEach(centerY=>{
    const textY=centerY-(box.y+box.height/2);
    svg.appendChild(createSvgElement("text",{
      x:textX,
      y:textY,
      "font-size":options.fontSize,
      "font-family":options.fontFamily,
      fill:"#111",
      class:"time-signature-glyph",
      "pointer-events":"none"
    },options.glyph));
  });
}

app.notationRenderer=Object.freeze({
  NS,createSvgElement,accidentalSmuflGlyph,drawLedger,
  drawKeySignature,rightEdgeOfSvgClass,drawTimeSignature
});
})();
