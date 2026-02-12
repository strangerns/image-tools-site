function compressImage(){

var file=document.getElementById("compressFile").files[0];

var reader=new FileReader();

reader.onload=function(e){

var img=new Image();

img.onload=function(){

var canvas=document.createElement("canvas");

canvas.width=img.width;
canvas.height=img.height;

var ctx=canvas.getContext("2d");

ctx.drawImage(img,0,0);

canvas.toBlob(function(blob){

var a=document.createElement("a");

a.href=URL.createObjectURL(blob);

a.download="compressed.jpg";

a.click();

},"image/jpeg",0.5);

};

img.src=e.target.result;

};

reader.readAsDataURL(file);

}



function convertImage(){

var file=document.getElementById("convertFile").files[0];

var format=document.getElementById("format").value;

var reader=new FileReader();

reader.onload=function(e){

var img=new Image();

img.onload=function(){

var canvas=document.createElement("canvas");

canvas.width=img.width;
canvas.height=img.height;

var ctx=canvas.getContext("2d");

ctx.drawImage(img,0,0);

canvas.toBlob(function(blob){

var a=document.createElement("a");

a.href=URL.createObjectURL(blob);

a.download="converted";

a.click();

},format);

};

img.src=e.target.result;

};

reader.readAsDataURL(file);

}



function resizeImage(){

var file=document.getElementById("resizeFile").files[0];

var width=document.getElementById("width").value;

var height=document.getElementById("height").value;

var reader=new FileReader();

reader.onload=function(e){

var img=new Image();

img.onload=function(){

var canvas=document.createElement("canvas");

canvas.width=width;
canvas.height=height;

var ctx=canvas.getContext("2d");

ctx.drawImage(img,0,0,width,height);

canvas.toBlob(function(blob){

var a=document.createElement("a");

a.href=URL.createObjectURL(blob);

a.download="resized.jpg";

a.click();

});

};

img.src=e.target.result;

};

reader.readAsDataURL(file);

}
