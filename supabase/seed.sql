-- ============================================================
-- SEED — itens do estoque (ajuste nomes/preços conforme o Bom Sabor)
-- Rode depois do schema.sql
-- ============================================================

insert into itens_estoque (categoria_id, nome, emoji, preco, ordem) values
-- Tamanhos
('tamanho', 'Mini', '🍚', 20.00, 1),
('tamanho', 'Pequena', '🍱', 21.00, 2),
('tamanho', 'Média', '🍛', 23.00, 3),
('tamanho', 'Grande', '🍲', 25.00, 4),
('tamanho', 'Executiva', '🍽️', 27.00, 5),

-- Arroz
('arroz', 'Arroz branco', '🍚', 0, 1),
('arroz', 'Arroz integral', '🌾', 0, 2),

-- Feijão
('feijao', 'Feijão carioca', '🫘', 0, 1),
('feijao', 'Tutu de feijão', '🥣', 0, 2),

-- Guarnições
('guarnicao', 'Viradinho de abobrinha', '🥒', 0, 1),
('guarnicao', 'Macarrão (molho branco e ao sugo)', '🍝', 0, 2),
('guarnicao', 'Torresmo', '🍖', 0, 3),
('guarnicao', 'Batata frita', '🥔', 0, 4),
('guarnicao', 'Berinjela à milanesa', '🍆', 0, 5),
('guarnicao', 'Batata doce', '🍠', 0, 6),

-- Saladas
('salada', 'Salada variada', '🥗', 0, 1),
('salada', 'Maionese de legumes', '🥙', 0, 2),
('salada', 'Beterraba', '🌰', 0, 3),

-- Carnes
('carne', 'Filé de frango à milanesa', '🍗', 0, 1),
('carne', 'Filé de frango grelhado', '🍗', 0, 2),
('carne', 'Pernil grelhado', '🥩', 0, 3),
('carne', 'Linguiça', '🌭', 0, 4),
('carne', 'Carne de panela', '🍖', 0, 5),
('carne', 'Omelete com queijo', '🍳', 0, 6),

-- Extras
('extra', 'Sem carne extra', '🚫', 0, 1),
('extra', 'Carne extra', '➕', 8.00, 2),
('extra', 'Carne extra à parmegiana', '➕', 12.00, 3);

-- Ativa todos os itens pra HOJE automaticamente (o admin depois desativa o que faltar)
insert into disponibilidade_dia (item_id, data, disponivel)
select id, current_date, true from itens_estoque;
