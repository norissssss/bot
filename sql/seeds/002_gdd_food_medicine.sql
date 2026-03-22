BEGIN;
INSERT OR IGNORE INTO items (code, name, category_id, tier, weight, stack_max, consumable, equip_slot, tags) VALUES
('food_ration_q1', 'Рацион Q1', 5, 1, 0.5, 64, 1, NULL, '{"food_quality":0.95}'),
('food_bread_std', 'Хлеб', 5, 1, 0.3, 64, 1, NULL, '{"food_quality":0.75}'),
('food_rice_std', 'Рис', 5, 1, 0.25, 64, 1, NULL, '{"food_quality":0.7}'),
('food_premium', 'Премиум-набор', 5, 3, 0.6, 32, 1, NULL, '{"food_quality":0.99,"energy_bonus":10}'),
('med_kit_basic', 'Аптечка', 6, 1, 0.4, 16, 1, NULL, '{"heal":15}'),
('med_drug_std', 'Лекарство', 6, 2, 0.1, 32, 1, NULL, '{"cure_disease":1}'),
('med_vaccine', 'Вакцина', 6, 3, 0.2, 8, 1, NULL, '{"immunity":1}'),
('mil_weapon_light', 'Лёгкое оружие', 7, 2, 2, 1, 0, 'weapon', '{}'),
('mil_ammo_std', 'Боеприпасы', 7, 1, 0.05, 256, 0, NULL, '{}'),
('mil_drone_striker', 'Дрон-ударник', 7, 4, 3, 1, 0, NULL, '{}');
COMMIT;
