insert into public.resources(kind,name,author,source,license,builtin_key,tags) values
('paper','Marfil','Escritura Creativa','Diseño CSS original','CC0','cream',array['clásico','cálido']),
('paper','Papel de algodón','Escritura Creativa','Diseño CSS original','CC0','cotton',array['natural']),
('paper','Cuaderno de líneas','Escritura Creativa','Diseño CSS original','CC0','lined',array['cuaderno']),
('paper','Papel antiguo','Escritura Creativa','Diseño CSS original','CC0','vintage',array['vintage']),
('paper','Rosa suave','Escritura Creativa','Diseño CSS original','CC0','rose',array['suave']),
('paper','Botánico','Escritura Creativa','Diseño CSS original','CC0','botanical',array['verde']),
('paper','Cuadrícula','Escritura Creativa','Diseño CSS original','CC0','grid',array['cuaderno']),
('paper','Blanco editorial','Escritura Creativa','Diseño CSS original','CC0','white',array['minimal']),
('font','Caveat','Pablo Impallari','https://fonts.google.com/specimen/Caveat','OFL-1.1','caveat',array['manuscrita']),
('font','Dancing Script','Impallari Type','https://fonts.google.com/specimen/Dancing+Script','OFL-1.1','dancing',array['manuscrita']),
('font','Kalam','Indian Type Foundry','https://fonts.google.com/specimen/Kalam','OFL-1.1','kalam',array['manuscrita']),
('font','Patrick Hand','Patrick Wagesreiter','https://fonts.google.com/specimen/Patrick+Hand','OFL-1.1','patrick',array['manuscrita']),
('font','Courier Prime','Quote-Unquote Apps','https://fonts.google.com/specimen/Courier+Prime','OFL-1.1','courier',array['máquina']),
('font','Special Elite','Astigmatic','https://fonts.google.com/specimen/Special+Elite','Apache-2.0','elite',array['máquina']),
('font','Lora','Cyreal','https://fonts.google.com/specimen/Lora','OFL-1.1','lora',array['lectura']),
('font','EB Garamond','Georg Duffner','https://fonts.google.com/specimen/EB+Garamond','OFL-1.1','garamond',array['lectura'])
on conflict do nothing;
