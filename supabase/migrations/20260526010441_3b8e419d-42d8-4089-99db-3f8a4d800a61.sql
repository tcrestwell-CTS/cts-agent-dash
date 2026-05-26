
-- Merge duplicate Donna Williams-Smith client (8706d82e) into canonical (34b1d233)
UPDATE trip_travelers SET linked_client_id='34b1d233-919c-4857-a1bf-6ec200eac203'
  WHERE linked_client_id='8706d82e-9686-449c-b7c2-2f4c1b8ebfc2';
UPDATE client_companions SET linked_client_id='34b1d233-919c-4857-a1bf-6ec200eac203'
  WHERE linked_client_id='8706d82e-9686-449c-b7c2-2f4c1b8ebfc2';
UPDATE clients SET status='active' WHERE id='34b1d233-919c-4857-a1bf-6ec200eac203';
DELETE FROM clients WHERE id='8706d82e-9686-449c-b7c2-2f4c1b8ebfc2';
