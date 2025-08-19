-- csvtool.lua — tiny CSV toolkit in one file (Lua 5.3+)
-- Commands: head, select, where, stats, sort, dedup, sample, tojson, print
-- Usage: lua csvtool.lua <cmd> <file or -> [k=v options...] [expr]
--   file: path to CSV, or "-" for stdin
--   Common opts: delim=,  noheader=1  out=csv|table  maxw=30
--   head: n=10
--   select: cols=a,b,c (names or 1-based indices)
--   where: <expr> (Lua expr; columns are variables; helpers: tonumber,strfind,match)
--   stats: cols=a,b  (numeric)   -> count,min,max,sum,mean,stdev
--   sort: by=col  asc|desc (default asc)  numeric=auto|1|0
--   dedup: by=a,b (keep first)
--   sample: n=100 (random)
--   tojson: (outputs NDJSON)
-- Notes:
--   - CSV parser supports RFC4180 quotes and commas/newlines in quotes.
--   - Type inference: numbers become Lua numbers (where possible).
--   - Expressions run in a minimal sandbox; no os/io.

local function die(msg) io.stderr:write("error: ", msg, "\n"); os.exit(1) end

-- tiny argparse: k=v pairs and bare flag "noheader=1"
local function parse_kv(args)
  local kv = {}
  for _,a in ipairs(args) do
    local k,v = a:match("^([%w_%-]+)=(.*)$")
    if k then kv[k]=v
    else kv[#kv+1]=a end
  end
  return kv
end

-- read all from file or stdin
local function read_all(path)
  local f
  if path == "-" then f = io.stdin else f = assert(io.open(path,"rb"), "cannot open "..path) end
  local s = f:read("*a")
  if path ~= "-" then f:close() end
  return s
end

-- detect delimiter by scanning the first (header) row outside quotes; prefer tab over comma when tabs > commas
local function detect_delim(text)
  local in_quote = false
  local comma, tab = 0, 0
  local i, n = 1, #text
  while i <= n do
    local c = text:sub(i,i)
    if in_quote then
      if c == '"' then
        local nxt = text:sub(i+1,i+1)
        if nxt == '"' then i = i + 1 else in_quote = false end
      end
    else
      if c == '"' then
        in_quote = true
      elseif c == "," then
        comma = comma + 1
      elseif c == "\t" then
        tab = tab + 1
      elseif c == "\n" then
        break
      elseif c == "\r" then
        -- ignore, handle on \n
      end
    end
    i = i + 1
  end
  if tab > comma then return "\t" else return "," end
end

-- CSV parser that handles quotes and newlines-in-quotes
local function parse_csv(text, delim)
  delim = delim or ","
  local rows = {}
  local i, n = 1, #text
  local row, field = {}, {}
  local function push_field()
    local s = table.concat(field)
    if s:match("^%s*-?%d+%.?%d*%s*$") then -- simple numeric
      s = tonumber(s)
    else
      -- unescape double quotes if quoted
      if s:sub(1,1) == '"' and s:sub(-1,-1) == '"' then
        s = s:sub(2,-2):gsub('""','"')
      end
    end
    row[#row+1] = s
    field = {}
  end
  local function push_row()
    rows[#rows+1] = row
    row = {}
  end
  local in_quote = false
  while i <= n do
    local c = text:sub(i,i)
    if in_quote then
      if c == '"' then
        local nxt = text:sub(i+1,i+1)
        if nxt == '"' then field[#field+1] = '"'; i = i + 1
        else in_quote = false end
      else
        field[#field+1] = c
      end
    else
      if c == '"' then
        in_quote = true
      elseif c == delim then
        push_field()
      elseif c == "\r" then
        -- ignore, handle on \n
      elseif c == "\n" then
        push_field(); push_row()
      else
        field[#field+1] = c
      end
    end
    i = i + 1
  end
  -- trailing field/row
  push_field()
  if #row > 1 or (#row==1 and tostring(row[1]) ~= "") then push_row() end
  return rows
end

local function load_csv(path, delim, noheader)
  local text = read_all(path)
  if text == "" then return {headers={}, rows={}, delim = delim or ","} end
  if not delim then delim = detect_delim(text) end
  local rows = parse_csv(text, delim)
  if #rows == 0 then return {headers={}, rows={}, delim=delim} end
  local headers
  if noheader then
    headers = {}
    for i=1,#rows[1] do headers[i] = "c"..i end
  else
    headers = rows[1]
    table.remove(rows,1)
  end
  -- normalize row lengths
  local w = #headers
  for _,r in ipairs(rows) do
    for i=#r+1,w do r[i] = nil end
  end
  return {headers=headers, rows=rows, delim=delim}
end

local function index_of(headers, name)
  if not name then return nil end
  if name:match("^%d+$") then
    local idx = tonumber(name)
    if idx < 1 or idx > #headers then die("column index out of range: "..name) end
    return idx
  end
  for i,h in ipairs(headers) do
    if h == name then return i end
  end
  die("unknown column: "..name)
end

local function split_csv_list(s)
  local out = {}
  for part in tostring(s):gmatch("[^,]+") do out[#out+1]=part end
  return out
end

local function shallow_copy(t) local u={} for i=1,#t do u[i]=t[i] end return u end

-- pretty table print
local function print_table(headers, rows, maxw)
  maxw = tonumber(maxw or 30)
  local W = {}
  for i,h in ipairs(headers) do W[i] = math.min(maxw, tostring(h):len()) end
  for _,r in ipairs(rows) do
    for i,v in ipairs(r) do
      local s = v==nil and "" or tostring(v)
      if s:len() > W[i] then W[i] = math.min(maxw, s:len()) end
    end
  end
  local function trunc(s,w)
    s = s or ""
    s = tostring(s)
    if #s <= w then return s end
    if w <= 3 then return s:sub(1,w) end
    return s:sub(1,w-3).."..."
  end
  local function line(sep,fill)
    local parts={}
    for i=1,#headers do parts[#parts+1] = string.rep(fill, W[i]) end
    print(sep..table.concat(parts, sep)..sep)
  end
  local function row_out(r)
    local cells={}
    for i=1,#headers do cells[#cells+1]=trunc(r[i], W[i]) end
    print("|"..table.concat(cells,"|").."|")
  end
  line("+","-"); row_out(headers); line("+","=")
  for _,r in ipairs(rows) do row_out(r) end
  line("+","-")
end

-- sandboxed eval of where expr
local function where_filter(headers, rows, expr)
  if not expr or expr == "" then return rows end
  local out = {}
  local env = {
    tonumber=tonumber, tostring=tostring, math=math, string=string,
    strfind=string.find, match=string.match, gmatch=string.gmatch, sub=string.sub, len=string.len,
    pairs=pairs, ipairs=ipairs, type=type,
    _G=nil, os=nil, io=nil, dofile=nil, loadfile=nil, require=nil, package=nil
  }
  local chunk, err = load("return ("..expr..")", "expr", "t", env)
  if not chunk then die("bad where expr: "..err) end
  for _,r in ipairs(rows) do
    -- bind columns
    for i,h in ipairs(headers) do env[h] = r[i] end
    local ok, keep = pcall(chunk)
    if ok and keep then out[#out+1] = r end
  end
  return out
end

local function select_cols(headers, rows, cols_spec)
  if not cols_spec then return headers, rows end
  local cols = split_csv_list(cols_spec)
  local idxs = {}
  local new_headers = {}
  for i, name in ipairs(cols) do
    local j = index_of(headers, name)
    idxs[i] = j; new_headers[i] = headers[j]
  end
  local new_rows = {}
  for _,r in ipairs(rows) do
    local nr = {}
    for i,j in ipairs(idxs) do nr[i] = r[j] end
    new_rows[#new_rows+1] = nr
  end
  return new_headers, new_rows
end

local function tojson(headers, rows)
  for _,r in ipairs(rows) do
    local parts = {}
    for i,h in ipairs(headers) do
      local v = r[i]
      local js
      if type(v) == "number" then js = tostring(v)
      elseif v == nil then js = "null"
      else
        js = '"'..tostring(v):gsub('\\','\\\\'):gsub('"','\\"'):gsub('\n','\\n'):gsub('\r','\\r')..'"'
      end
      parts[#parts+1] = '"'..tostring(h):gsub('\\','\\\\'):gsub('"','\\"')..'":'..js
    end
    print("{"..table.concat(parts,",").."}")
  end
end

local function stats(headers, rows, cols_spec)
  local cols = cols_spec and split_csv_list(cols_spec) or headers
  local idxs = {}
  for _,c in ipairs(cols) do idxs[#idxs+1] = index_of(headers, c) end
  local S = {}
  for k,_ in ipairs(idxs) do S[k]={count=0,sum=0,min=math.huge,max=-math.huge,m2=0} end
  for _,r in ipairs(rows) do
    for k,idx in ipairs(idxs) do
      local v = r[idx]
      if type(v)=="number" then
        local s = S[k]
        s.count = s.count + 1
        s.sum = s.sum + v
        if v < s.min then s.min = v end
        if v > s.max then s.max = v end
        -- Welford variance
        local delta = v - (s.mean or 0)
        s.mean = (s.mean or 0) + delta / s.count
        s.m2 = s.m2 + delta * (v - s.mean)
      end
    end
  end
  local out_headers = {"col","count","min","max","sum","mean","stdev"}
  local out_rows = {}
  for k,idx in ipairs(idxs) do
    local s = S[k]
    local stdev = (s.count>1) and math.sqrt(s.m2/(s.count-1)) or 0
    out_rows[#out_rows+1] = {headers[idx], s.count, s.min==math.huge and nil or s.min,
      s.max==-math.huge and nil or s.max, s.sum, s.mean, stdev}
  end
  print_table(out_headers, out_rows, 40)
end

local function cmp_fn(headers, by, desc, numeric_mode)
  local idx = index_of(headers, by or headers[1])
  local descmul = desc and -1 or 1
  return function(a,b)
    local va, vb = a[idx], b[idx]
    local na = type(va)=="number"
    local nb = type(vb)=="number"
    local numeric = (numeric_mode=="1") or (numeric_mode=="auto" and na and nb)
    if numeric then
      va = tonumber(va or 0) or -math.huge
      vb = tonumber(vb or 0) or -math.huge
    else
      va = tostring(va or "")
      vb = tostring(vb or "")
    end
    if va == vb then return false end
    return (va < vb) and (descmul>0) or (va > vb) and (descmul<0)
  end
end

local function sort_rows(headers, rows, by, order, numeric)
  table.sort(rows, cmp_fn(headers, by, (order=="desc"), numeric or "auto"))
end

local function dedup_rows(headers, rows, by)
  local cols = by and split_csv_list(by) or {headers[1]}
  local idxs = {}
  for i,c in ipairs(cols) do idxs[i]=index_of(headers,c) end
  local seen = {}
  local out = {}
  for _,r in ipairs(rows) do
    local key_parts = {}
    for _,j in ipairs(idxs) do key_parts[#key_parts+1] = tostring(r[j] or "") end
    local key = table.concat(key_parts,"\x1F")
    if not seen[key] then
      seen[key]=true; out[#out+1]=r
    end
  end
  return out
end

local function sample_rows(rows, n)
  n = tonumber(n or 10)
  if n >= #rows then return rows end
  -- reservoir sampling
  local res = {}
  for i=1,n do res[i] = rows[i] end
  for i=n+1,#rows do
    local j = math.random(i)
    if j <= n then res[j] = rows[i] end
  end
  return res
end

local function out_mode(kv) return (kv.out=="table") and "table" or "csv" end
local function write_csv(headers, rows, delim)
  delim = delim or ","
  local function esc(s)
    if s==nil then return "" end
    if type(s)=="number" then return tostring(s) end
    s = tostring(s)
    if s:find('[\n\r"'..delim..']') then
      s = '"'..s:gsub('"','""')..'"'
    end
    return s
  end
  local function emit_row(r)
    local cells = {}
    for i=1,#headers do cells[i]=esc(r[i]) end
    print(table.concat(cells, delim))
  end
  emit_row(headers)
  for _,r in ipairs(rows) do emit_row(r) end
end

-- main
local function main(argv)
  if #argv < 2 then
    io.stderr:write([[
csvtool — commands: head, select, where, stats, sort, dedup, sample, tojson, print

Examples:
  lua csvtool.lua head data.csv n=5
  lua csvtool.lua where data.csv 'price > 10 and category == "book"'
  lua csvtool.lua select data.csv cols=title,price
  lua csvtool.lua stats data.csv cols=price,quantity
  lua csvtool.lua sort data.csv by=price desc
  lua csvtool.lua dedup data.csv by=title,isbn
  lua csvtool.lua tojson data.csv > out.ndjson
]])
    os.exit(1)
  end
  local cmd = argv[1]
  local file = argv[2]
  local rest = {}
  for i=3,#argv do rest[#rest+1]=argv[i] end
  -- split positional expr (for 'where') from k=v
  local expr
  if cmd == "where" then
    -- last arg that isn't k=v is expr
    if #rest == 0 then die("where requires an expression") end
    -- collect non k=v as expr (join by space to allow spaces)
    local kvs, bare = {}, {}
    for _,a in ipairs(rest) do
      if a:match("^[%w_%-]+=") then kvs[#kvs+1]=a else bare[#bare+1]=a end
    end
    expr = table.concat(bare," ")
    rest = kvs
  end
  local kv = parse_kv(rest)
  local delim = kv.delim
  local noheader = kv.noheader == "1"
  local ds = load_csv(file, delim, noheader)
  local used_delim = ds.delim or ","
  local headers, rows = ds.headers, ds.rows

  if cmd == "head" then
    local n = tonumber(kv.n or 10)
    local subset = {}
    for i=1,math.min(n,#rows) do subset[i] = rows[i] end
    if out_mode(kv) == "table" then print_table(headers, subset, kv.maxw) else write_csv(headers, subset, used_delim) end

  elseif cmd == "print" then
    if out_mode(kv) == "table" then print_table(headers, rows, kv.maxw) else write_csv(headers, rows, used_delim) end

  elseif cmd == "select" then
    local newH, newR = select_cols(headers, rows, kv.cols or die("select needs cols=a,b"))
    if out_mode(kv) == "table" then print_table(newH, newR, kv.maxw) else write_csv(newH, newR, used_delim) end

  elseif cmd == "where" then
    local filtered = where_filter(headers, rows, expr)
    if out_mode(kv) == "table" then print_table(headers, filtered, kv.maxw) else write_csv(headers, filtered, used_delim) end

  elseif cmd == "stats" then
    stats(headers, rows, kv.cols)

  elseif cmd == "sort" then
    sort_rows(headers, rows, kv.by, argv[3]=="desc" and "desc" or kv.order, kv.numeric or "auto")
    if out_mode(kv) == "table" then print_table(headers, rows, kv.maxw) else write_csv(headers, rows, used_delim) end

  elseif cmd == "dedup" then
    local out = dedup_rows(headers, rows, kv.by)
    if out_mode(kv) == "table" then print_table(headers, out, kv.maxw) else write_csv(headers, out, used_delim) end

  elseif cmd == "sample" then
    local out = sample_rows(rows, kv.n or 10)
    if out_mode(kv) == "table" then print_table(headers, out, kv.maxw) else write_csv(headers, out, used_delim) end

  elseif cmd == "tojson" then
    tojson(headers, rows)

  else
    die("unknown command: "..cmd)
  end
end

-- entry
if pcall(debug.getlocal, 4, 1) == false then
  main(arg)
end
