-- New built-in papers and fonts suited to letters.
insert into public.resources(kind,name,author,source,license,builtin_key,tags) values
('paper','Pergamino','Escritura Creativa','Diseño CSS original','CC0','parchment',array['vintage','cálido']),
('paper','Kraft','Escritura Creativa','Diseño CSS original','CC0','kraft',array['natural']),
('paper','Verjurado','Escritura Creativa','Diseño CSS original','CC0','laid',array['clásico']),
('paper','Correo aéreo','Escritura Creativa','Diseño CSS original','CC0','airmail',array['carta']),
('paper','Acuarela','Escritura Creativa','Diseño CSS original','CC0','watercolor',array['artístico']),
('paper','Lavanda','Escritura Creativa','Diseño CSS original','CC0','lavender',array['suave']),
('paper','Punteado','Escritura Creativa','Diseño CSS original','CC0','dotted',array['cuaderno']),
('font','Great Vibes','TypeSETit','https://fonts.google.com/specimen/Great+Vibes','OFL-1.1','greatvibes',array['manuscrita']),
('font','Parisienne','Astigmatic','https://fonts.google.com/specimen/Parisienne','OFL-1.1','parisienne',array['manuscrita']),
('font','Homemade Apple','Font Diner','https://fonts.google.com/specimen/Homemade+Apple','Apache-2.0','homemade',array['manuscrita']),
('font','Cormorant Garamond','Christian Thalmann','https://fonts.google.com/specimen/Cormorant+Garamond','OFL-1.1','cormorant',array['lectura']),
('font','Libre Baskerville','Impallari Type','https://fonts.google.com/specimen/Libre+Baskerville','OFL-1.1','baskerville',array['lectura']),
('font','Playfair Display','Claus Eggers Sørensen','https://fonts.google.com/specimen/Playfair+Display','OFL-1.1','playfair',array['clásica']),
('font','IM Fell English','Igino Marini','https://fonts.google.com/specimen/IM+Fell+English','OFL-1.1','fell',array['antigua'])
on conflict do nothing;
