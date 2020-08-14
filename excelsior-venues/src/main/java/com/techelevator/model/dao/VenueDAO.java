package com.techelevator.model.dao;

import java.util.List;
import java.util.Map;

import com.techelevator.model.domain.Venue;

public interface VenueDAO {

	public List<Venue> getAllVenues();
	public Map<Integer, Venue> venueMapper(List<Venue> venues);
	public List<String> getCategories(Venue venue);

}

	
