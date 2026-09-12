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

app.notationRenderer=Object.freeze({
  NS,createSvgElement,accidentalSmuflGlyph,drawLedger
});
})();
