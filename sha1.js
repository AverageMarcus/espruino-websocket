// Taken from: http://jumspruino.jumware.com/sources/ESP8266Test.js

//this is SHA1
function split(n,x){ for(var i=3; i>=0;i--){x.push((n>>(i*8)) & 0xff);} }
function f(s, x, y, z)  {
  switch (s) {
    case 0: return (x & y) ^ (~x & z);           // Ch()
    case 1: return  x ^ y  ^  z;                 // Parity()
    case 2: return (x & y) ^ (x & z) ^ (y & z);  // Maj()
    case 3: return  x ^ y  ^  z;                 // Parity()
  }
}
function ROTL(x, n) {return (x<<n) | (x>>>(32-n));}
function FLT(h,n){ return (h + n) & 0xffffffff; }
function SHA1(msg){
  var K,l,N,M,i,j,H0,H1,H2,H3,H4;
  var W,a,b,c,d,e,x,v;
  var flt = 0xffffffff; 
  K = new Int32Array([ 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6 ]);
  msg += String.fromCharCode(0x80);
  l = msg.length/4 + 2; 
  N = Math.ceil(l/16); 
  M = new Array(N);
  for (i=0; i<N; i++) {
    x = new Int32Array(16);
    for(j=0;j<16;j++){
      v = (msg.charCodeAt(i*64+j*4)<<24) | (msg.charCodeAt(i*64+j*4+1)<<16) | (msg.charCodeAt(i*64+j*4+2)<<8) | (msg.charCodeAt(i*64+j*4+3));
      x[j] = v;
    }
    M[i] = x;
  }
  M[N-1][14] = ((msg.length-1)*8) / Math.pow(2, 32); M[N-1][14] = Math.floor(M[N-1][14]);
  M[N-1][15] = ((msg.length-1)*8) & flt;
  H0 = 0x67452301;H1 = 0xefcdab89;H2 = 0x98badcfe;H3 = 0x10325476;H4 = 0xc3d2e1f0;
  W = new Int32Array(80);
  for (i=0; i<N; i++) {
    for (j=0;  j<16; j++) W[j] = M[i][j];
    for (j=16; j<80; j++){
      a = W[j-3] ^ W[j-8] ^ W[j-14] ^ W[j-16];
      W[j] = ROTL(a, 1);
    }
    a = H0; b = H1; c = H2; d = H3; e = H4;
    for (j=0; j<80; j++) {
      var s = Math.floor(j/20); 
      var T = (ROTL(a,5) + f(s,b,c,d) + e + K[s] + W[j]) & flt;
       e = d;d = c;c = ROTL(b, 30);b = a;a = T;
    }
    H0 = FLT(H0,a);H1 = FLT(H1,b);H2 = FLT(H2,c);H3 = FLT(H3,d);H4 = FLT(H4,e);
  }
  x = [];
  split(H0,x);split(H1,x);split(H2,x);split(H3,x);split(H4,x);
  return x;  
}

exports = SHA1;
