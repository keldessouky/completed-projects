package com.techelevator.model.dao;

import java.util.List;

import com.techelevator.model.domain.Space;

public interface SpaceDAO {

	public List<Space> getSpacesFromVenue(String venueName);
	
	public List<Space> getSpaceById(long spaceId);
	
	public List<Space> getRateById(long spaceId);
}
