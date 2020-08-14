package com.techelevator;

import com.techelevator.view.Inventory;

import org.junit.Assert;

import java.util.List;

import org.junit.Before;
import org.junit.Test;

public class InventoryTest {
	
	private Inventory inventory;
	
	
	
	@Before
	public void testInventory() {
		inventory = new Inventory();
	}
	
	@Test
	public void testCheckAvailabilityOfItem() {
		//Assert.assertEquals("given B1 and 50", true, inventory.checkAvailabilityOfItem(B1, 50));
		//Assert.assertEquals("given Z5 and 50", false, inventory.checkAvailabilityOfItem(Z5, 50));
		//Assert.assertEquals("given B2 and 50", true, inventory.checkAvailabilityOfItem(B2, 50));
		//Assert.assertEquals("given X3 and 50", false, inventory.checkAvailabilityOfItem(X3, 50));
		
	}
	
	@Test
	public void testGetItemName() {
//		Assert.assertEquals("given product id B1", "Soda", inventory.getItemName(B1));
//		Assert.assertEquals("given product id B2", "Wine", inventory.getItemName(B2));
//		Assert.assertEquals(inventory.getItemName("B3"), "Beer");
		
	}
	
}
