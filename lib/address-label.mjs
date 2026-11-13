// Display only street addresses from older labels that concatenated geocoding fields.
export function addressLabel(value) {
 if(value && typeof value==='object') {
  for(const key of ['streetAddress','address','formattedAddress','fullAddress','label'])if(typeof value[key]==='string'&&value[key].trim())return addressLabel(value[key]);
  return '';
 }
 const parts=String(value||'').split(/[·|]/).map(s=>s.trim()).filter(Boolean);
 const streets=parts.filter(s=>/^\d+[\w\s–—,-]*\s(?:street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|court|ct|way|crescent|cres|terrace|trail|place|parkway|highway)\b/i.test(s));
 const unique=[];
 for(const street of streets){
  const clean=street.replace(/\s+Toronto\b.*$/i,'').trim();
  if(!unique.some(s=>s.toLowerCase()===clean.toLowerCase()))unique.push(clean);
 }
 if(unique.length)return unique.join('; ');
 return parts.filter(s=>!/^[-+]?\d{1,3}\.\d+$/.test(s)&&!['Toronto','Ontario','Canada'].includes(s)&&!/^\w\d\w\s?\d\w\d$/i.test(s)).filter((s,i,a)=>a.indexOf(s)===i).join(', ');
}
