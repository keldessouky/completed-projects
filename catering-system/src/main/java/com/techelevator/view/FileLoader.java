package com.techelevator.view;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Scanner;
import java.util.TreeMap;

import com.techelevator.Item;

public class FileLoader {
	public Map<String, Item> fileReader() {
		File stockOrder = new File("cateringsystem.csv");				//reading the text file and adding the lines
		Map<String, Item> inventoryMap = new TreeMap<String, Item>();	//into a new map for inventory
		List<Item> tempList = new ArrayList<Item>();
		try (Scanner scanner = new Scanner(stockOrder)) {
			while (scanner.hasNextLine()) {
				String[] tempArray = scanner.nextLine().split("\\|");
				Item item = new Item(tempArray[0], tempArray[1], Double.valueOf(tempArray[2]), tempArray[3]);
				tempList.add(item);
			}								// a list is unnecessary here, you can just put in the inventoryMap directly
			for (Item item : tempList) {
				inventoryMap.put(item.getItemCode(), item);
			}

		} catch (Exception e) {
			e.printStackTrace();
		}
		return inventoryMap;

	}

}		