CREATE TABLE public.party_master (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_name text NOT NULL, phone_number text, email text, gstin text, address text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.party_master TO authenticated; GRANT ALL ON public.party_master TO service_role;
ALTER TABLE public.party_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY factory_access ON public.party_master FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TABLE public.item_master (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), box_type text NOT NULL, size_dimensions text NOT NULL, specification text, unit_rate numeric NOT NULL DEFAULT 0 CHECK(unit_rate>=0), created_at timestamptz DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.item_master TO authenticated; GRANT ALL ON public.item_master TO service_role; ALTER TABLE public.item_master ENABLE ROW LEVEL SECURITY; CREATE POLICY factory_access ON public.item_master FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE TABLE public.orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_no text NOT NULL UNIQUE DEFAULT ('PO-'||upper(substr(gen_random_uuid()::text,1,8))), party_id uuid REFERENCES public.party_master(id), is_self_stock boolean NOT NULL DEFAULT false, order_date date NOT NULL DEFAULT CURRENT_DATE, expected_date date NOT NULL DEFAULT CURRENT_DATE, medium text DEFAULT 'Other' CHECK(medium IN('WhatsApp','Call','Mail','Other')), remarks text, status text NOT NULL DEFAULT 'Pending', created_at timestamptz DEFAULT now(), CHECK(is_self_stock OR party_id IS NOT NULL), CHECK(expected_date>=order_date));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.orders TO authenticated; GRANT ALL ON public.orders TO service_role; ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY; CREATE POLICY factory_access ON public.orders FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE TABLE public.order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id), sr_no int NOT NULL, box_type text NOT NULL, code_remarks text, size_dimensions text NOT NULL, specification text, ordered_qty int NOT NULL CHECK(ordered_qty>0), allocated_qty int NOT NULL DEFAULT 0, completed_qty int NOT NULL DEFAULT 0, reserved_qty int NOT NULL DEFAULT 0, dispatched_qty int NOT NULL DEFAULT 0, unit_rate numeric NOT NULL DEFAULT 0 CHECK(unit_rate>=0), total_price numeric GENERATED ALWAYS AS(ordered_qty*unit_rate) STORED, priority_signal text NOT NULL DEFAULT 'Yellow' CHECK(priority_signal IN('Red','Yellow','Green')), created_at timestamptz DEFAULT now(), UNIQUE(order_id,sr_no), CHECK(0<=dispatched_qty AND dispatched_qty+reserved_qty<=completed_qty AND completed_qty<=allocated_qty AND allocated_qty<=ordered_qty AND reserved_qty>=0));
GRANT SELECT ON public.order_items TO authenticated; GRANT ALL ON public.order_items TO service_role; ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY; CREATE POLICY factory_access ON public.order_items FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE TABLE public.labour_master (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), labour_name text NOT NULL, phone text, daily_rate numeric NOT NULL DEFAULT 0 CHECK(daily_rate>=0), unit_assignment text, created_at timestamptz DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.labour_master TO authenticated; GRANT ALL ON public.labour_master TO service_role; ALTER TABLE public.labour_master ENABLE ROW LEVEL SECURITY; CREATE POLICY factory_access ON public.labour_master FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE TABLE public.production_allocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_item_id uuid NOT NULL REFERENCES public.order_items(id), labour_id uuid NOT NULL REFERENCES public.labour_master(id), allocated_qty int NOT NULL CHECK(allocated_qty>0), labour_rate numeric NOT NULL CHECK(labour_rate>=0), start_time timestamptz NOT NULL DEFAULT now(), duration_hours int NOT NULL CHECK(duration_hours BETWEEN 1 AND 10), tentative_completion timestamptz NOT NULL, completed_qty int NOT NULL DEFAULT 0 CHECK(completed_qty>=0 AND completed_qty<=allocated_qty), paid_earnings numeric NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'In Progress', created_at timestamptz DEFAULT now());
GRANT SELECT ON public.production_allocations TO authenticated; GRANT ALL ON public.production_allocations TO service_role; ALTER TABLE public.production_allocations ENABLE ROW LEVEL SECURITY; CREATE POLICY factory_access ON public.production_allocations FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE TABLE public.delivery_challans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), challan_number text NOT NULL UNIQUE DEFAULT('DC-'||upper(substr(gen_random_uuid()::text,1,8))), order_id uuid NOT NULL REFERENCES public.orders(id), dispatch_date timestamptz NOT NULL DEFAULT now(), transport_carrier text, vehicle_number text, lr_number text, freight_charges numeric NOT NULL DEFAULT 0 CHECK(freight_charges>=0), status text NOT NULL DEFAULT 'Delivery Challan Made', delivery_status text DEFAULT 'Pending', created_at timestamptz DEFAULT now());
GRANT SELECT ON public.delivery_challans TO authenticated; GRANT ALL ON public.delivery_challans TO service_role; ALTER TABLE public.delivery_challans ENABLE ROW LEVEL SECURITY; CREATE POLICY factory_access ON public.delivery_challans FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE TABLE public.challan_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), challan_id uuid NOT NULL REFERENCES public.delivery_challans(id), order_item_id uuid NOT NULL REFERENCES public.order_items(id), dispatched_qty int NOT NULL CHECK(dispatched_qty>0), direct_labour_cost numeric NOT NULL DEFAULT 0, UNIQUE(challan_id,order_item_id));
GRANT SELECT ON public.challan_items TO authenticated; GRANT ALL ON public.challan_items TO service_role; ALTER TABLE public.challan_items ENABLE ROW LEVEL SECURITY; CREATE POLICY factory_access ON public.challan_items FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE TABLE public.labour_borrowings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), labour_id uuid NOT NULL REFERENCES public.labour_master(id), borrow_date date NOT NULL DEFAULT CURRENT_DATE, amount numeric NOT NULL CHECK(amount>0), deducted_amount numeric NOT NULL DEFAULT 0 CHECK(deducted_amount>=0 AND deducted_amount<=amount), remarks text, created_at timestamptz DEFAULT now());
GRANT SELECT ON public.labour_borrowings TO authenticated; GRANT ALL ON public.labour_borrowings TO service_role; ALTER TABLE public.labour_borrowings ENABLE ROW LEVEL SECURITY; CREATE POLICY factory_access ON public.labour_borrowings FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE TABLE public.expenses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), expense_date date NOT NULL DEFAULT CURRENT_DATE, category text NOT NULL, reference_dc_id uuid REFERENCES public.delivery_challans(id), amount numeric NOT NULL CHECK(amount>0), payment_method text DEFAULT 'Cash', notes text, created_at timestamptz DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.expenses TO authenticated; GRANT ALL ON public.expenses TO service_role; ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY; CREATE POLICY factory_access ON public.expenses FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE TABLE public.labour_payroll (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), labour_id uuid NOT NULL REFERENCES public.labour_master(id), payout_date date DEFAULT CURRENT_DATE, gross numeric NOT NULL, deductions numeric NOT NULL, net_paid numeric NOT NULL, status text DEFAULT 'Paid', created_at timestamptz DEFAULT now());
GRANT SELECT ON public.labour_payroll TO authenticated; GRANT ALL ON public.labour_payroll TO service_role; ALTER TABLE public.labour_payroll ENABLE ROW LEVEL SECURITY; CREATE POLICY factory_access ON public.labour_payroll FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE TABLE public.push_subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), endpoint text NOT NULL UNIQUE, p256dh text NOT NULL, auth text NOT NULL, created_at timestamptz DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.push_subscriptions TO authenticated; GRANT ALL ON public.push_subscriptions TO service_role; ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY; CREATE POLICY own_push ON public.push_subscriptions FOR ALL TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
CREATE TABLE public.factory_notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, body text NOT NULL, path text NOT NULL DEFAULT '/', created_at timestamptz DEFAULT now());
GRANT SELECT ON public.factory_notifications TO authenticated; GRANT ALL ON public.factory_notifications TO service_role; ALTER TABLE public.factory_notifications ENABLE ROW LEVEL SECURITY; CREATE POLICY factory_read ON public.factory_notifications FOR SELECT TO authenticated USING(true);
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role text NOT NULL CHECK(role IN('admin','user')), UNIQUE(user_id,role));
GRANT SELECT ON public.user_roles TO authenticated; GRANT ALL ON public.user_roles TO service_role; ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY; CREATE POLICY own_role ON public.user_roles FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.factory_action(action text, payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item public.order_items; allocation public.production_allocations; challan public.delivery_challans; obj jsonb; rid uuid; oid uuid; qty int; rate numeric; earnings numeric; debt numeric; deduction numeric; remaining numeric; borrowing record;
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to continue'; END IF;
IF action='order' THEN
INSERT INTO orders(party_id,is_self_stock,order_date,expected_date,medium,remarks) VALUES(CASE WHEN (payload->>'is_self_stock')::boolean THEN NULL ELSE (payload->>'party_id')::uuid END,COALESCE((payload->>'is_self_stock')::boolean,false),(payload->>'order_date')::date,(payload->>'expected_date')::date,payload->>'medium',payload->>'remarks') RETURNING id INTO oid;
IF jsonb_array_length(payload->'items')=0 THEN RAISE EXCEPTION 'Add at least one order item'; END IF;
FOR obj IN SELECT value FROM jsonb_array_elements(payload->'items') LOOP
INSERT INTO order_items(order_id,sr_no,box_type,code_remarks,size_dimensions,specification,ordered_qty,unit_rate,priority_signal) VALUES(oid,(obj->>'sr_no')::int,obj->>'box_type',obj->>'code_remarks',obj->>'size_dimensions',obj->>'specification',(obj->>'ordered_qty')::int,COALESCE((obj->>'unit_rate')::numeric,0),obj->>'priority_signal');
IF obj->>'priority_signal'='Red' THEN INSERT INTO factory_notifications(title,body,path) VALUES('High-priority order','A high-priority order needs production allocation.','/production'); END IF;
END LOOP; rid:=oid;
ELSIF action='allocate' THEN
SELECT * INTO STRICT item FROM order_items WHERE id=(payload->>'order_item_id')::uuid FOR UPDATE;
qty:=(payload->>'allocated_qty')::int; IF qty<=0 OR qty>item.ordered_qty-item.allocated_qty THEN RAISE EXCEPTION 'Quantity exceeds remaining production'; END IF;
INSERT INTO production_allocations(order_item_id,labour_id,allocated_qty,labour_rate,start_time,duration_hours,tentative_completion) VALUES(item.id,(payload->>'labour_id')::uuid,qty,(payload->>'labour_rate')::numeric,(payload->>'start_time')::timestamptz,(payload->>'duration_hours')::int,(payload->>'start_time')::timestamptz+make_interval(hours=>(payload->>'duration_hours')::int)) RETURNING id INTO rid;
UPDATE order_items SET allocated_qty=allocated_qty+qty WHERE id=item.id; UPDATE orders SET status='In Production' WHERE id=item.order_id;
ELSIF action='complete' THEN
SELECT order_item_id INTO oid FROM production_allocations WHERE id=(payload->>'id')::uuid;
PERFORM id FROM order_items WHERE id=oid FOR UPDATE;
SELECT * INTO STRICT allocation FROM production_allocations WHERE id=(payload->>'id')::uuid FOR UPDATE;
qty:=(payload->>'completed_qty')::int; IF qty<allocation.completed_qty OR qty>allocation.allocated_qty THEN RAISE EXCEPTION 'Completed quantity must be between previous completion and allocated quantity'; END IF;
UPDATE order_items SET completed_qty=completed_qty+qty-allocation.completed_qty WHERE id=allocation.order_item_id;
UPDATE production_allocations SET completed_qty=qty,status=CASE WHEN qty=allocated_qty THEN 'Completed' ELSE 'Partial' END WHERE id=allocation.id; rid:=allocation.id;
IF qty=allocation.allocated_qty AND qty>allocation.completed_qty THEN INSERT INTO factory_notifications(title,body,path) VALUES('Production completed','An allocation is ready for dispatch.','/dispatch'); END IF;
ELSIF action='challan' THEN
SELECT * INTO STRICT item FROM order_items WHERE id=(payload->>'order_item_id')::uuid FOR UPDATE;
qty:=(payload->>'dispatched_qty')::int; IF qty<=0 OR qty>item.completed_qty-item.dispatched_qty-item.reserved_qty THEN RAISE EXCEPTION 'Quantity exceeds available completed production'; END IF;
INSERT INTO delivery_challans(order_id,transport_carrier,vehicle_number,lr_number,freight_charges,dispatch_date) VALUES(item.order_id,payload->>'transport_carrier',payload->>'vehicle_number',payload->>'lr_number',COALESCE((payload->>'freight_charges')::numeric,0),(payload->>'dispatch_date')::timestamptz) RETURNING id INTO rid;
SELECT COALESCE(sum(completed_qty*labour_rate)/NULLIF(sum(completed_qty),0),0) INTO rate FROM production_allocations WHERE order_item_id=item.id;
INSERT INTO challan_items(challan_id,order_item_id,dispatched_qty,direct_labour_cost) VALUES(rid,item.id,qty,qty*rate);
UPDATE order_items SET reserved_qty=reserved_qty+qty WHERE id=item.id;
ELSIF action='dispatch' THEN
SELECT * INTO STRICT challan FROM delivery_challans WHERE id=(payload->>'id')::uuid FOR UPDATE;
IF challan.status<>'Delivery Challan Made' THEN RAISE EXCEPTION 'Challan has already been dispatched'; END IF;
FOR obj IN SELECT to_jsonb(c) FROM challan_items c WHERE challan_id=challan.id ORDER BY order_item_id LOOP
UPDATE order_items SET reserved_qty=reserved_qty-(obj->>'dispatched_qty')::int,dispatched_qty=dispatched_qty+(obj->>'dispatched_qty')::int WHERE id=(obj->>'order_item_id')::uuid;
END LOOP;
UPDATE delivery_challans SET status='Dispatched' WHERE id=challan.id; UPDATE orders SET status=CASE WHEN NOT EXISTS(SELECT 1 FROM order_items WHERE order_id=challan.order_id AND dispatched_qty<ordered_qty) THEN 'Completed' ELSE 'Dispatched' END WHERE id=challan.order_id;
INSERT INTO factory_notifications(title,body,path) VALUES('Delivery dispatched',challan.challan_number||' has been dispatched.','/dispatch'); rid:=challan.id;
ELSIF action='borrow' THEN
PERFORM id FROM labour_master WHERE id=(payload->>'labour_id')::uuid FOR UPDATE;
INSERT INTO labour_borrowings(labour_id,borrow_date,amount,remarks) VALUES((payload->>'labour_id')::uuid,(payload->>'borrow_date')::date,(payload->>'amount')::numeric,payload->>'remarks') RETURNING id INTO rid;
ELSIF action='payroll' THEN
PERFORM id FROM labour_master WHERE id=(payload->>'labour_id')::uuid FOR UPDATE;
PERFORM id FROM production_allocations WHERE labour_id=(payload->>'labour_id')::uuid FOR UPDATE;
SELECT COALESCE(sum(completed_qty*labour_rate-paid_earnings),0) INTO earnings FROM production_allocations WHERE labour_id=(payload->>'labour_id')::uuid;
IF earnings<=0 THEN RAISE EXCEPTION 'No unpaid production earnings'; END IF;
SELECT COALESCE(sum(amount-deducted_amount),0) INTO debt FROM labour_borrowings WHERE labour_id=(payload->>'labour_id')::uuid;
deduction:=LEAST(earnings,debt); remaining:=deduction;
FOR borrowing IN SELECT * FROM labour_borrowings WHERE labour_id=(payload->>'labour_id')::uuid AND deducted_amount<amount ORDER BY borrow_date,id FOR UPDATE LOOP
rate:=LEAST(remaining,borrowing.amount-borrowing.deducted_amount); UPDATE labour_borrowings SET deducted_amount=deducted_amount+rate WHERE id=borrowing.id; remaining:=remaining-rate;
END LOOP;
UPDATE production_allocations SET paid_earnings=completed_qty*labour_rate WHERE labour_id=(payload->>'labour_id')::uuid;
INSERT INTO labour_payroll(labour_id,gross,deductions,net_paid,amount_paid,status) VALUES((payload->>'labour_id')::uuid,earnings,deduction,earnings-deduction,0,CASE WHEN (earnings-deduction)<=0 THEN 'Paid' ELSE 'Pending' END) RETURNING id INTO rid;
ELSIF action='disburse' THEN
INSERT INTO labour_payroll_disbursements(payroll_id,amount,payment_mode,reference_notes,disbursed_at) VALUES((payload->>'payroll_id')::uuid,(payload->>'amount')::numeric,COALESCE(payload->>'payment_mode','Cash'),payload->>'reference_notes',COALESCE((payload->>'disbursed_at')::timestamptz,now())) RETURNING id INTO rid;
ELSIF action='cancel_challan' THEN
SELECT * INTO STRICT challan FROM delivery_challans WHERE id=(payload->>'id')::uuid FOR UPDATE;
IF challan.status<>'Delivery Challan Made' THEN RAISE EXCEPTION 'Only non-dispatched challans in "Delivery Challan Made" status can be cancelled'; END IF;
FOR obj IN SELECT to_jsonb(c) FROM challan_items c WHERE challan_id=challan.id LOOP
UPDATE order_items SET reserved_qty=GREATEST(0,reserved_qty-(obj->>'dispatched_qty')::int) WHERE id=(obj->>'order_item_id')::uuid;
END LOOP;
UPDATE delivery_challans SET status='Cancelled' WHERE id=challan.id; rid:=challan.id;
ELSE RAISE EXCEPTION 'Unknown factory action'; END IF;
RETURN jsonb_build_object('id',rid);
END; $$;
REVOKE ALL ON FUNCTION public.factory_action(text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.factory_action(text,jsonb) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders,public.order_items,public.production_allocations,public.delivery_challans,public.factory_notifications;