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

function measureSvgTextGlyph(svg,glyph,fontSize,fontFamily){
  // Measure the exact glyph geometry from the same SVG/font used for rendering.
  // A temporary invisible probe avoids relying on font baseline assumptions.
  const probe=createSvgElement("text",{
    x:0,y:0,
    "font-size":fontSize,
    "font-family":fontFamily,
    visibility:"hidden",
    "pointer-events":"none"
  },glyph);

  svg.appendChild(probe);

  let box={x:0,y:-fontSize*.75,width:fontSize*.55,height:fontSize};
  try{
    const measured=probe.getBBox();
    if(measured && measured.width>0 && measured.height>0){
      box={
        x:measured.x,
        y:measured.y,
        width:measured.width,
        height:measured.height
      };
    }
  }catch(err){
    console.warn("SVG glyph measurement fallback:",err);
  }

  probe.remove();
  return box;
}

function noteheadHalfWidthForRhythm(svg,rhythm,options){
  const glyph=
    rhythm==="whole" ? options.smufl.noteheadWhole :
    rhythm==="half" ? options.smufl.noteheadHalf :
    rhythm==="eighth" ? options.smufl.noteheadBlack :
    null;

  if(glyph){
    const box=measureSvgTextGlyph(svg,glyph,options.fontSize,options.fontFamily);
    if(box && box.width>0) return box.width/2;
  }

  // Existing custom ellipse noteheads (quarter/sixteenth).
  return 10.8;
}

function drawNotehead(group,svg,x,y,rhythm,fill,options){
  const useSmuflHead=["whole","half","eighth"].includes(rhythm);

  if(useSmuflHead){
    const glyph=
      rhythm==="whole" ? options.smufl.noteheadWhole :
      rhythm==="half" ? options.smufl.noteheadHalf :
      options.smufl.noteheadBlack;

    const box=measureSvgTextGlyph(svg,glyph,options.fontSize,options.fontFamily);
    const textX=x-(box.x+box.width/2);

    group.appendChild(createSvgElement("text",{
      x:textX,
      y,
      "font-size":options.fontSize,
      "font-family":options.fontFamily,
      fill,
      class:`smufl-notehead smufl-notehead-${rhythm}`,
      "pointer-events":"none"
    },glyph));
  }else{
    group.appendChild(createSvgElement("ellipse",{
      cx:x,cy:y,rx:10.8,ry:7.2,
      fill,
      stroke:fill,
      "stroke-width":2,
      transform:`rotate(-18 ${x} ${y})`
    }));
  }
}

function drawAccidentalForNote(group,svg,accidental,noteX,noteY,fill,rhythm,options){
  const glyph=accidentalSmuflGlyph(accidental,options.smufl);
  if(!glyph) return;

  const box=measureSvgTextGlyph(svg,glyph,options.fontSize,options.fontFamily);
  const noteHalfWidth=noteheadHalfWidthForRhythm(svg,rhythm,options);
  const noteHeadLeft=noteX-noteHalfWidth;
  const targetRight=noteHeadLeft-options.accidentalToNoteGap;
  const textX=targetRight-(box.x+box.width);

  group.appendChild(createSvgElement("text",{
    x:textX,
    y:noteY,
    "font-size":options.fontSize,
    "font-family":options.fontFamily,
    fill,
    class:"score-accidental",
    "pointer-events":"none"
  },glyph));
}

function drawStemAndFlag(group,x,y,rhythm,fill,dir,beamGroup,options){
  const sx=dir==="up"?x+10:x-10;
  const endY=dir==="up"?y-55:y+55;

  if(!beamGroup || !["eighth","sixteenth"].includes(rhythm)){
    group.appendChild(createSvgElement("line",{x1:sx,y1:y,x2:sx,y2:endY,stroke:fill,"stroke-width":2.3}));
  }

  if(["eighth","sixteenth"].includes(rhythm)&&!beamGroup){
    // SMuFL provides separate combining flags for up/down stems.
    // Using the dedicated down glyph prevents the flag from being mirrored.
    const flagGlyph=rhythm==="sixteenth"
      ? (dir==="up" ? options.smufl.flag16thUp : options.smufl.flag16thDown)
      : (dir==="up" ? options.smufl.flag8thUp : options.smufl.flag8thDown);

    group.appendChild(createSvgElement("text",{
      x:sx,
      y:endY,
      "font-size":options.fontSize,
      "font-family":options.fontFamily,
      fill,
      class:`smufl-flag smufl-flag-${rhythm}-${dir}`,
      "pointer-events":"none"
    },flagGlyph));
  }
}

app.notationRenderer=Object.freeze({
  NS,createSvgElement,accidentalSmuflGlyph,drawLedger,
  drawKeySignature,rightEdgeOfSvgClass,drawTimeSignature,
  measureSvgTextGlyph,noteheadHalfWidthForRhythm,drawNotehead,
  drawAccidentalForNote,drawStemAndFlag
});
})();
