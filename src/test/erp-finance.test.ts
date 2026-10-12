import {describe,it,expect} from 'vitest';
import {emptyData,finance,type FactoryData} from '@/lib/erp-data';
describe('Realised profit',()=>{
 it('ignores unconfirmed challans',()=>{const data={...emptyData,challans:[{id:'draft',status:'Delivery Challan Made'}]} as unknown as FactoryData;expect(finance(data)).toEqual([]);});
 it('uses dispatched quantity and allocates each expense once',()=>{const data={...emptyData,items:[{id:'item',unit_rate:200}],challans:[{id:'dc',status:'Dispatched',freight_charges:100}],challanItems:[{challan_id:'dc',order_item_id:'item',dispatched_qty:25,direct_labour_cost:500}],expenses:[{reference_dc_id:null,amount:200},{reference_dc_id:'dc',amount:100}]} as unknown as FactoryData;const result=finance(data);expect(result[0]?.revenue).toBe(5000);expect(result[0]?.expenses).toBe(300);expect(result[0]?.profit).toBe(4100);expect(result[0]?.margin).toBe(82);});
});
